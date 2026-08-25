/**
 * Orchestrates Python project extraction against a directory on local disk,
 * producing shared-model (`@/lore/model`) pieces: a `Project`, internal
 * dependency `Relationship`s, `EntryPoint`s, `PublicContract`s,
 * `TestRelationship`s, and `Gap`s — the same shape as the JS/TS extractor's
 * `JsTsExtraction` (`src/analysis/js-ts/extract-project.ts`).
 *
 * This does not yet assemble a full `Lore` (findings, snapshot metadata) or
 * derived views (Start Here, major areas) — that's implementation session 13.
 */

import path from "node:path";
import type {
  EntryPoint,
  Evidence,
  ExternalDependency,
  Gap,
  Project as LoreProject,
  PublicContract,
  Relationship,
  TestRelationship,
} from "@/lore/model";
import { discoverSourceFiles } from "./discovery";
import { extractEntryPoints } from "./entry-points";
import { extractExternalDependencies } from "./external-dependencies";
import { extractImportRelationships } from "./imports";
import { extractPublicSurface } from "./public-surface";
import { readPythonProjectConfig } from "./project-config";
import { extractTestRelationships } from "./tests";

export interface PythonExtraction {
  project: LoreProject;
  sourceFilePaths: string[];
  relationships: Relationship[];
  entryPoints: EntryPoint[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  externalDependencies: ExternalDependency[];
  gaps: Gap[];
}

/**
 * Conservative project-kind inference from entry-point shape, mirroring
 * the JS/TS extractor: a runtime bootstrap or console-script entry implies
 * an application; a bare library entry with no bootstrap implies a library;
 * anything else is left unknown rather than guessed.
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
        description:
          "A runtime bootstrap or console-script entry point was detected.",
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
          "A package's __init__.py was declared as its public entry point, with no runtime bootstrap detected.",
      },
    };
  }

  return { kind: "unknown" };
}

export async function extractPythonProject(
  rootDir: string,
  projectId = "."
): Promise<PythonExtraction> {
  const absoluteRoot = path.resolve(rootDir);
  const sourceFiles = await discoverSourceFiles(absoluteRoot);
  const config = await readPythonProjectConfig(absoluteRoot);

  const importResult = extractImportRelationships(sourceFiles, absoluteRoot);
  const entryPoints = extractEntryPoints(sourceFiles, absoluteRoot, config);
  const publicContracts = extractPublicSurface(entryPoints, sourceFiles);
  const testResult = extractTestRelationships(
    sourceFiles,
    importResult.resolvedDependenciesByFile
  );
  const externalDependencies = extractExternalDependencies(
    config.dependencies,
    importResult.externalReferences,
    projectId
  );

  const sourceFilePaths = sourceFiles.map((sf) => sf.relativePath);

  const { kind, evidence: kindEvidence } = inferProjectKind(entryPoints);
  const projectEvidence: Evidence[] = [];
  if (kindEvidence) projectEvidence.push(kindEvidence);

  const project: LoreProject = {
    id: projectId,
    name: config.name ?? path.basename(absoluteRoot),
    kind,
    languages: ["python"],
    rootPath: ".",
    frameworks: [],
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
    externalDependencies,
    gaps: [...importResult.gaps, ...testResult.gaps],
  };
}
