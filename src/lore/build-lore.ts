/**
 * Assembles a full `Lore` (the durable, persisted unit — see
 * `docs/architecture/decisions/0005-analysis-result-keying.md`) from one or
 * more language extractions' output plus their derived views
 * (`@/analysis/shared/derive-views`), plus the repository/commit identity
 * that only exists once a real GitHub repository has been resolved and
 * fetched. Used for a real analysis run, the local `/fixtures` pages, and
 * both JS/TS and Python, so every language renders through the same `Lore`
 * shape via one shared assembly function.
 *
 * A real submission can select more than one analyzer (ADR-0007 — a
 * genuinely polyglot repository, e.g. a Python service with a JS/TS
 * frontend). Each extraction contributes its own `Project` to
 * `Lore.projects`; every other array is a plain concatenation — no
 * cross-language relationship is invented — except `startHere`, which is
 * interleaved across languages and capped so the merged result still
 * respects the model's existing `START_HERE_MIN_ITEMS`/`START_HERE_MAX_ITEMS`
 * bound rather than simply overflowing it.
 */

import type { DerivedViews } from "@/analysis/shared/derive-views";
import { computeFunctionImportance } from "@/analysis/shared/function-importance";
import {
  evaluateMinimumValueContract,
  START_HERE_MAX_ITEMS,
  type AnalysisSnapshot,
  type BehaviorEdge,
  type BehaviorNode,
  type CallableSignature,
  type CallEdge,
  type EntryPoint,
  type ExternalDependency,
  type Gap,
  type Lore,
  type Project,
  type PublicContract,
  type Recommendation,
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
  externalDependencies: ExternalDependency[];
  /** JS/TS only for now (ADR-0012); absent for a Python extraction until its own follow-on ADR adds call-graph support. */
  callableSignatures?: CallableSignature[];
  callEdges?: CallEdge[];
  /** Program Behavior Graph (ADR-0013), JS/TS only for now, same reasoning as `callableSignatures`/`callEdges`. */
  behaviorNodes?: BehaviorNode[];
  behaviorEdges?: BehaviorEdge[];
  gaps: Gap[];
}

/** One language's extraction output paired with its derived views. */
export interface BuildLoreProjectInput {
  extraction: BuildLoreExtraction;
  views: DerivedViews;
}

export interface BuildLoreInput {
  owner: string;
  repo: string;
  defaultBranch: string;
  description?: string;
  isPrivate: boolean;
  commitSha: string;
  analyzerVersion: string;
  analyzedAt: string;
  /** One entry per analyzer selected for this repository (ADR-0007) — almost always one, sometimes more for a mixed-language repository. */
  extractions: BuildLoreProjectInput[];
}

/**
 * Interleaves each language's already-ordered Start Here list (round-robin,
 * preferring earlier items from every list before later ones) rather than
 * concatenating them, then caps and renumbers to `START_HERE_MAX_ITEMS`. A
 * single-extraction input (the common case) passes through unchanged aside
 * from renumbering, which is always a no-op for an already-correctly-ordered
 * list.
 */
function mergeStartHere(startHereLists: Recommendation[][]): Recommendation[] {
  const merged: Recommendation[] = [];
  const maxLength = Math.max(0, ...startHereLists.map((list) => list.length));
  outer: for (let i = 0; i < maxLength; i++) {
    for (const list of startHereLists) {
      if (merged.length >= START_HERE_MAX_ITEMS) break outer;
      if (i < list.length) merged.push(list[i]);
    }
  }
  return merged.map((item, index) => ({
    ...item,
    id: `start-here-${index + 1}`,
    order: index + 1,
  }));
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
    isPrivate,
    commitSha,
    analyzerVersion,
    analyzedAt,
    extractions,
  } = input;

  const repository: Repository = {
    owner,
    name: repo,
    description,
    defaultBranch,
    url: `https://github.com/${owner}/${repo}`,
    isPrivate,
  };

  const snapshot: AnalysisSnapshot = {
    id: `${owner}/${repo}@${commitSha}:${analyzerVersion}`,
    repository,
    commitSha,
    analyzedAt,
    analyzerVersion,
    status: "partial",
  };

  const callableSignatures = extractions.flatMap(
    (e) => e.extraction.callableSignatures ?? []
  );
  const behaviorNodes = extractions.flatMap(
    (e) => e.extraction.behaviorNodes ?? []
  );
  const behaviorEdges = extractions.flatMap(
    (e) => e.extraction.behaviorEdges ?? []
  );
  const entryPoints = extractions.flatMap((e) => e.extraction.entryPoints);

  const lore: Lore = {
    snapshot,
    projects: extractions.map((e) => e.extraction.project),
    structuralAreas: extractions.flatMap((e) => e.views.structuralAreas),
    entryPoints,
    relationships: extractions.flatMap((e) => e.extraction.relationships),
    publicContracts: extractions.flatMap((e) => e.extraction.publicContracts),
    testRelationships: extractions.flatMap(
      (e) => e.extraction.testRelationships
    ),
    externalDependencies: extractions.flatMap(
      (e) => e.extraction.externalDependencies
    ),
    callableSignatures,
    callEdges: extractions.flatMap((e) => e.extraction.callEdges ?? []),
    behaviorNodes,
    behaviorEdges,
    // ADR-0013: computed once, language-neutrally, over the fully-assembled
    // arrays above — ready for a Python extraction the moment it starts
    // populating callableSignatures/behaviorEdges of its own.
    functionImportance: computeFunctionImportance(
      callableSignatures,
      behaviorEdges,
      behaviorNodes,
      entryPoints
    ),
    startHere: mergeStartHere(extractions.map((e) => e.views.startHere)),
    findings: [],
    gaps: extractions.flatMap((e) => e.extraction.gaps),
  };

  const contract = evaluateMinimumValueContract(lore);
  const meetsContract = Object.values(contract).every(Boolean);
  snapshot.status = meetsContract ? "completed" : "partial";

  return lore;
}
