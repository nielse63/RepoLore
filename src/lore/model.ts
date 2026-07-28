/**
 * The shared, language-neutral Lore domain model (see docs/MODEL_OUTPUT.md,
 * "Shared Lore Domain Model"). These types are the durable product: language
 * extractors (JS/TS, Python, ...) populate them, but nothing here is specific
 * to any one extractor.
 */

export type Language = "typescript" | "javascript" | "python";

/**
 * The four certainty categories every important conclusion must expose
 * (docs/MODEL_OUTPUT.md, "Evidence and Gaps"). No numeric confidence scores.
 */
export type CertaintyCategory =
  "detected" | "inferred" | "unknown" | "unsupported";

export type EntityId = string;

/** A file and optional symbol or configuration path within it. */
export interface SourceLocation {
  /** Repo-root-relative path, e.g. "src/index.ts" or "pyproject.toml". */
  filePath: string;
  /** Symbol at that location, e.g. an exported function or class name. */
  symbolName?: string;
  /** Config key path for evidence rooted in a config file, e.g. "scripts.start". */
  configKey?: string;
  startLine?: number;
  endLine?: number;
}

/**
 * The observable source supporting a fact or inference. Every non-trivial
 * conclusion in the model should carry at least one of these.
 */
export interface Evidence {
  /** What kind of signal this is, e.g. "import-statement", "package-json-field", "pyproject-entry-point". */
  kind: string;
  certainty: CertaintyCategory;
  location?: SourceLocation;
  /** Plain-language explanation of how this evidence supports the conclusion. */
  description: string;
}

/** An unknown, unsupported construct, or other material analysis limitation. */
export interface Gap {
  certainty: Extract<CertaintyCategory, "unknown" | "unsupported">;
  description: string;
  location?: SourceLocation;
  /** IDs of model entities this gap limits the interpretation of, if any. */
  affects?: EntityId[];
}

/** The GitHub repository identity and metadata. */
export interface Repository {
  owner: string;
  name: string;
  description?: string;
  defaultBranch: string;
  url: string;
}

/** Repository, default branch, commit SHA, timestamp, and analyzer version identifying one analysis run. */
export interface AnalysisSnapshot {
  id: EntityId;
  repository: Repository;
  commitSha: string;
  analyzedAt: string;
  analyzerVersion: string;
  status: "completed" | "partial" | "failed";
}

/** A detected application, package, or library within the repository. */
export interface Project {
  id: EntityId;
  name: string;
  kind: "application" | "library" | "package" | "unknown";
  languages: Language[];
  /** Repo-root-relative path to the project's root. */
  rootPath: string;
  /** Confidently recognized frameworks, e.g. "react". */
  frameworks: string[];
  evidence: Evidence[];
  gaps: Gap[];
}

/** An evidence-backed major part of a project or repository. */
export interface StructuralArea {
  id: EntityId;
  projectId: EntityId;
  name: string;
  location: SourceLocation;
  /** Why this was identified as an area. */
  rationale: string;
  /** Probable responsibility, only when evidence supports one. */
  responsibility?: string;
  importantLocations: SourceLocation[];
  entryPointIds: EntityId[];
  directDependencyIds: EntityId[];
  directDependentIds: EntityId[];
  testRelationshipIds: EntityId[];
  evidence: Evidence[];
  gaps: Gap[];
}

export type EntryPointKind =
  | "runtime"
  | "bootstrap"
  | "library"
  | "public-export"
  | "cli"
  | "framework"
  | "test";

/** A probable start of execution or exposed public surface. */
export interface EntryPoint {
  id: EntityId;
  kind: EntryPointKind;
  location: SourceLocation;
  certainty: CertaintyCategory;
  evidence: Evidence[];
  /** Meaningful ambiguity or alternative candidates. */
  alternatives?: SourceLocation[];
}

export type RelationshipKind =
  "depends-on" | "depended-on-by" | "exports-to" | "cross-language";

/** A directed, evidence-backed connection between model entities (projects, areas, entry points, contracts). */
export interface Relationship {
  id: EntityId;
  kind: RelationshipKind;
  fromId: EntityId;
  toId: EntityId;
  certainty: CertaintyCategory;
  evidence: Evidence[];
}

/** An exported or otherwise declared interface to an area. */
export interface PublicContract {
  id: EntityId;
  areaId: EntityId;
  name: string;
  kind: "export" | "cli-command" | "api-route" | "other";
  location: SourceLocation;
  evidence: Evidence[];
}

/** A detectable connection between a test and the implementation it exercises. */
export interface TestRelationship {
  id: EntityId;
  testLocation: SourceLocation;
  implementationLocation: SourceLocation;
  certainty: CertaintyCategory;
  evidence: Evidence[];
}

/** An ordered Start Here item with rationale and evidence. */
export interface Recommendation {
  id: EntityId;
  order: number;
  location: SourceLocation;
  /** What the location appears to represent. */
  whatItRepresents: string;
  /** Why the user should inspect it at this point in the sequence. */
  rationale: string;
  certainty: CertaintyCategory;
  evidence: Evidence[];
}

/** A high-confidence prompt for further investigation ("Things to Investigate"). */
export interface Finding {
  id: EntityId;
  description: string;
  relatedIds: EntityId[];
  evidence: Evidence[];
}

/** The full evidence-backed mental model for one analysis snapshot. */
export interface Lore {
  snapshot: AnalysisSnapshot;
  projects: Project[];
  structuralAreas: StructuralArea[];
  entryPoints: EntryPoint[];
  relationships: Relationship[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  startHere: Recommendation[];
  findings: Finding[];
  gaps: Gap[];
}

/** Bounds on the Start Here path length (docs/MODEL_OUTPUT.md, "Start Here"). */
export const START_HERE_MIN_ITEMS = 3;
export const START_HERE_MAX_ITEMS = 7;

/**
 * The minimum value contract a Lore must satisfy before being presented as
 * fully supported (docs/product/mvp.md, "Minimum Value Contract"). This type
 * exists to be checked, not merely documented — see `meetsMinimumValueContract`.
 */
export interface MinimumValueContract {
  hasRepositoryOrientation: boolean;
  hasMeaningfulStartHere: boolean;
  hasMajorAreaModel: boolean;
  hasProbableEntryPoints: boolean;
  hasDirectRelationships: boolean;
  hasTraceableEvidence: boolean;
}

/** Every piece of evidence attached anywhere in a Lore, used by both the minimum value contract and evidence-coverage displays (e.g. the Architecture page, ADR-0008). */
function collectEvidence(lore: Lore): Evidence[] {
  return [
    ...lore.projects.flatMap((p) => p.evidence),
    ...lore.structuralAreas.flatMap((a) => a.evidence),
    ...lore.entryPoints.flatMap((e) => e.evidence),
    ...lore.relationships.flatMap((r) => r.evidence),
    ...lore.startHere.flatMap((r) => r.evidence),
  ];
}

/** Total evidence count across a Lore — a real "evidence coverage" figure, not a fabricated one. */
export function countEvidence(lore: Lore): number {
  return collectEvidence(lore).length;
}

/**
 * Evaluates whether a Lore satisfies the minimum value contract. A Lore that
 * can list files and imports but fails this check has not met the product
 * promise (docs/product/mvp.md: "If Repo Lore can extract files and imports
 * but cannot create a useful reading path, it has not satisfied the product
 * promise.").
 */
export function evaluateMinimumValueContract(lore: Lore): MinimumValueContract {
  const hasMeaningfulStartHere =
    lore.startHere.length >= START_HERE_MIN_ITEMS &&
    lore.startHere.length <= START_HERE_MAX_ITEMS &&
    lore.startHere.every((item) => item.evidence.length > 0);

  const allEvidence = collectEvidence(lore);

  return {
    hasRepositoryOrientation: lore.projects.length > 0,
    hasMeaningfulStartHere,
    hasMajorAreaModel: lore.structuralAreas.length > 0,
    hasProbableEntryPoints: lore.entryPoints.length > 0,
    hasDirectRelationships: lore.relationships.length > 0,
    hasTraceableEvidence: allEvidence.every((e) => e.location !== undefined),
  };
}
