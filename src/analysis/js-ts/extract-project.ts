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

function readPackageName(rootDir: string): string | undefined {
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) return undefined;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      name?: string;
    };
    return pkg.name;
  } catch {
    return undefined;
  }
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
 * Conservative project-kind inference from entry-point shape: a runtime
 * bootstrap or CLI entry implies an application; a bare library/module
 * manifest field with no bootstrap implies a library. Anything else is
 * left unknown rather than guessed.
 */
function inferProjectKind(entryPoints: EntryPoint[]): {
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

  const libraryEntry = entryPoints.find((ep) => ep.kind === "library");
  if (libraryEntry) {
    return {
      kind: "library",
      evidence: {
        kind: "entry-point-shape",
        certainty: "inferred",
        location: libraryEntry.location,
        description:
          "A package.json library entry field (main/module) was declared, with no runtime bootstrap detected.",
      },
    };
  }

  return { kind: "unknown" };
}

export function extractJsTsProject(
  rootDir: string,
  projectId = "."
): JsTsExtraction {
  const absoluteRoot = path.resolve(rootDir);
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

  const { kind, evidence: kindEvidence } = inferProjectKind(entryPoints);
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
    name: readPackageName(absoluteRoot) ?? path.basename(absoluteRoot),
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
