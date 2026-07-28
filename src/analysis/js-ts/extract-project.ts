/**
 * Orchestrates JS/TS project extraction against a directory on local disk,
 * producing shared-model (`@/lore/model`) pieces: a `Project`, internal
 * dependency `Relationship`s, `EntryPoint`s, `PublicContract`s,
 * `TestRelationship`s, detected React components, and `Gap`s.
 *
 * This does not yet assemble a full `Lore` (findings, snapshot metadata) —
 * structural areas and Start Here are derived from this output separately,
 * in `./derive-views`.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  EntryPoint,
  Evidence,
  Gap,
  Project as LoreProject,
  PublicContract,
  Relationship,
  TestRelationship,
} from "@/lore/model";
import { discoverSourceFiles } from "./discovery";
import { extractEntryPoints } from "./entry-points";
import { extractImportRelationships } from "./imports";
import { extractPublicSurface } from "./public-surface";
import {
  detectReactComponents,
  type DetectedReactComponent,
} from "./react-components";
import { extractTestRelationships } from "./tests";

export interface JsTsExtraction {
  project: LoreProject;
  sourceFilePaths: string[];
  relationships: Relationship[];
  entryPoints: EntryPoint[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  reactComponents: DetectedReactComponent[];
  gaps: Gap[];
}

interface PackageJsonMeta {
  name?: string;
  main?: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPackageJson(rootDir: string): PackageJsonMeta | undefined {
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJsonMeta;
  } catch {
    return undefined;
  }
}

/**
 * Common web/UI framework packages (session 20 heuristic): presence in any
 * dependency field is treated as an application-implying signal, not gated
 * on direct-vs-peer placement — a real UI component library that peer-depends
 * on one of these and declares "main"/"exports" will therefore still be
 * misclassified as an application. Accepted for now (product owner call);
 * see the implementation plan for the deferred fix.
 */
const UI_FRAMEWORK_PACKAGES = [
  "react",
  "vue",
  "@angular/core",
  "svelte",
  "solid-js",
  "preact",
  "lit",
];

function detectFrameworkDependency(
  pkg: PackageJsonMeta | undefined
): string | undefined {
  if (!pkg) return undefined;
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  return UI_FRAMEWORK_PACKAGES.find((name) => name in allDeps);
}

function detectLanguages(sourceFilePaths: string[]): LoreProject["languages"] {
  const languages = new Set<LoreProject["languages"][number]>();
  for (const filePath of sourceFilePaths) {
    if (/\.tsx?$/.test(filePath)) languages.add("typescript");
    else if (/\.jsx?$/.test(filePath)) languages.add("javascript");
  }
  return [...languages];
}

/**
 * Project-kind inference (session 20): a detected runtime bootstrap or CLI
 * entry point wins outright. Otherwise, package.json's raw "main"/"exports"
 * fields decide manifest shape directly (not the resolved EntryPoint list —
 * this also correctly classifies packages whose "main"/"exports" points at a
 * gitignored build artifact that never resolves to a source file). Neither
 * field present implies an application (nothing declared for consumers to
 * import); either field present implies a library, unless a common UI
 * framework dependency or detected UI components in source suggest it's
 * really an application that merely happens to declare an entry field.
 * package.json's "imports" field is deliberately not part of this check —
 * it's Node's internal subpath-import map ("#foo" specifiers), not a public
 * entry point, and plenty of ordinary applications set it for internal path
 * aliasing.
 */
function inferProjectKind(
  entryPoints: EntryPoint[],
  pkg: PackageJsonMeta | undefined,
  reactComponents: DetectedReactComponent[]
): {
  kind: LoreProject["kind"];
  evidence?: Evidence;
} {
  const applicationEntry = entryPoints.find(
    (ep) => ep.kind === "bootstrap" || ep.kind === "cli"
  );
  if (applicationEntry) {
    return {
      kind: "application",
      evidence: {
        kind: "entry-point-shape",
        certainty: "inferred",
        location: applicationEntry.location,
        description: "A runtime bootstrap or CLI entry point was detected.",
      },
    };
  }

  const hasLibraryField = pkg?.main !== undefined || pkg?.exports !== undefined;
  if (!hasLibraryField) {
    return {
      kind: "application",
      evidence: {
        kind: "package-json-entry-field-shape",
        certainty: "inferred",
        location: { filePath: "package.json" },
        description:
          'package.json declares neither "main" nor "exports", so no library entry point is declared; assumed to be an application.',
      },
    };
  }

  const frameworkDependency = detectFrameworkDependency(pkg);
  if (frameworkDependency) {
    return {
      kind: "application",
      evidence: {
        kind: "framework-dependency",
        certainty: "inferred",
        location: { filePath: "package.json" },
        description: `package.json declares "main"/"exports" but depends on "${frameworkDependency}", a UI framework; assumed to be an application rather than a library.`,
      },
    };
  }

  if (reactComponents.length > 0) {
    return {
      kind: "application",
      evidence: {
        kind: "react-component-detection",
        certainty: "inferred",
        location: reactComponents[0].location,
        description: `package.json declares "main"/"exports" but ${reactComponents.length} React component(s) were detected in source (e.g. '${reactComponents[0].location.filePath}'); assumed to be an application rather than a library.`,
      },
    };
  }

  return {
    kind: "library",
    evidence: {
      kind: "package-json-entry-field-shape",
      certainty: "inferred",
      location: { filePath: "package.json" },
      description:
        'package.json declares "main" and/or "exports" with no application-implying signal (runtime bootstrap, CLI, UI framework dependency, or detected UI components).',
    },
  };
}

export function extractJsTsProject(
  rootDir: string,
  projectId = "."
): JsTsExtraction {
  const absoluteRoot = path.resolve(rootDir);
  const pkg = readPackageJson(absoluteRoot);
  const { sourceFiles } = discoverSourceFiles(absoluteRoot);

  const importResult = extractImportRelationships(sourceFiles, absoluteRoot);
  const entryPoints = extractEntryPoints(sourceFiles, absoluteRoot);
  const publicContracts = extractPublicSurface(
    entryPoints,
    sourceFiles,
    absoluteRoot
  );
  const packageEntryPointFilePaths = new Set(
    entryPoints
      .filter((ep) => ep.kind === "library")
      .map((ep) => ep.location.filePath)
  );
  const testResult = extractTestRelationships(
    sourceFiles,
    absoluteRoot,
    packageEntryPointFilePaths
  );
  const reactComponents = detectReactComponents(sourceFiles, absoluteRoot);

  const sourceFilePaths = sourceFiles.map((sf) =>
    path.relative(absoluteRoot, sf.getFilePath()).split(path.sep).join("/")
  );

  const { kind, evidence: kindEvidence } = inferProjectKind(
    entryPoints,
    pkg,
    reactComponents
  );
  const frameworks: string[] = [];
  const projectEvidence: Evidence[] = [];

  if (reactComponents.length > 0) {
    frameworks.push("react");
    projectEvidence.push({
      kind: "react-component-detection",
      certainty: "detected",
      location: reactComponents[0].location,
      description: `Detected ${reactComponents.length} React component(s) via JSX-returning functions or class components extending Component (e.g. '${reactComponents[0].location.filePath}').`,
    });
  }
  if (kindEvidence) projectEvidence.push(kindEvidence);

  const project: LoreProject = {
    id: projectId,
    name: pkg?.name ?? path.basename(absoluteRoot),
    kind,
    languages: detectLanguages(sourceFilePaths),
    rootPath: ".",
    frameworks,
    evidence: projectEvidence,
    gaps: [],
  };

  return {
    project,
    sourceFilePaths,
    relationships: importResult.relationships,
    entryPoints,
    publicContracts,
    testRelationships: testResult.testRelationships,
    reactComponents,
    gaps: [...importResult.gaps, ...testResult.gaps],
  };
}
