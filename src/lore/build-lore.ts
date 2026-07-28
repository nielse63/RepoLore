/**
 * Assembles a full `Lore` (the durable, persisted unit — see
 * `docs/architecture/decisions/0005-analysis-result-keying.md`) from any
 * language's extraction output plus its derived views
 * (`@/analysis/shared/derive-views`), plus the repository/commit identity
 * that only exists once a real GitHub repository has been resolved and
 * fetched. Used for a real analysis run, the local `/fixtures` pages, and
 * both JS/TS and Python, so every language renders through the same `Lore`
 * shape via one shared assembly function.
 */

import type { DerivedViews } from "@/analysis/shared/derive-views";
import {
  evaluateMinimumValueContract,
  type AnalysisSnapshot,
  type EntryPoint,
  type Gap,
  type Lore,
  type Project,
  type PublicContract,
  type Relationship,
  type Repository,
  type TestRelationship,
} from "./model";

/**
 * The subset of a language extraction's output `buildLore` actually needs —
 * both `JsTsExtraction` and `PythonExtraction` satisfy this structurally
 * (each has additional, language-specific fields this function never reads).
 */
export interface BuildLoreExtraction {
  project: Project;
  entryPoints: EntryPoint[];
  relationships: Relationship[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  gaps: Gap[];
}

export interface BuildLoreInput {
  owner: string;
  repo: string;
  defaultBranch: string;
  description?: string;
  commitSha: string;
  analyzerVersion: string;
  analyzedAt: string;
  extraction: BuildLoreExtraction;
  views: DerivedViews;
}

/**
 * `snapshot.status` is computed from the assembled `Lore` itself — a run is
 * only `'completed'` if it actually satisfies the MVP's minimum value
 * contract (`evaluateMinimumValueContract`), not merely because extraction
 * didn't throw. Anything short of that (e.g. an unsupported/near-empty
 * project) is honestly `'partial'` rather than dressed up as a full result.
 */
export function buildLore(input: BuildLoreInput): Lore {
  const {
    owner,
    repo,
    defaultBranch,
    description,
    commitSha,
    analyzerVersion,
    analyzedAt,
    extraction,
    views,
  } = input;

  const repository: Repository = {
    owner,
    name: repo,
    description,
    defaultBranch,
    url: `https://github.com/${owner}/${repo}`,
  };

  const snapshot: AnalysisSnapshot = {
    id: `${owner}/${repo}@${commitSha}:${analyzerVersion}`,
    repository,
    commitSha,
    analyzedAt,
    analyzerVersion,
    status: "partial",
  };

  const lore: Lore = {
    snapshot,
    projects: [extraction.project],
    structuralAreas: views.structuralAreas,
    entryPoints: extraction.entryPoints,
    relationships: extraction.relationships,
    publicContracts: extraction.publicContracts,
    testRelationships: extraction.testRelationships,
    startHere: views.startHere,
    findings: [],
    gaps: extraction.gaps,
  };

  const contract = evaluateMinimumValueContract(lore);
  const meetsContract = Object.values(contract).every(Boolean);
  snapshot.status = meetsContract ? "completed" : "partial";

  return lore;
}
