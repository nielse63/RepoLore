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
  /** GitHub's own visibility flag at analysis time — never inferred or defaulted. */
  isPrivate: boolean;
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

export type CallableKind =
  "function" | "method" | "arrow" | "function-expression";

/**
 * A single parameter of a `CallableSignature`. `typeAnnotation` is the
 * parameter's explicit source type annotation, verbatim — never an inferred
 * type (ADR-0012 keeps type detection to explicit annotations only,
 * consistent with ADR-0003's syntactic-only scope). `certainty` is
 * `"detected"` when an annotation is present, `"unknown"` otherwise; there
 * is no "inferred" middle ground for a parameter type.
 */
export interface CallableParameter {
  name: string;
  typeAnnotation?: string;
  certainty: Extract<CertaintyCategory, "detected" | "unknown">;
}

/**
 * A named function, method, or named arrow/function-expression tracked by
 * the call graph (ADR-0012). Anonymous function expressions and arrow
 * functions (not assigned to a variable or property) are never represented
 * here — there is no name to search for or display. Distinct from
 * `PublicContract`, which records exported surface regardless of call
 * relationships.
 */
export interface CallableSignature {
  id: EntityId;
  name: string;
  kind: CallableKind;
  location: SourceLocation;
  parameters: CallableParameter[];
  /** The function's explicit return type annotation, verbatim, if present — never inferred. */
  returnType?: string;
  returnCertainty: Extract<CertaintyCategory, "detected" | "unknown">;
  evidence: Evidence[];
}

/**
 * A statically-resolved, direct call from one `CallableSignature` to
 * another — the call graph's edges (ADR-0012). `certainty` is always
 * `"detected"`: an edge is only ever created when a plain-identifier call
 * unambiguously resolves to a same-file or named-import-resolved callable,
 * so there is no "inferred" call edge. Everything that doesn't resolve this
 * way (method/property-access calls, calls through a variable or callback,
 * dynamic dispatch, default-imported callables, ambiguous name matches) is
 * deliberately not recorded here at all — see ADR-0012 for why this is a
 * disclosed structural limitation rather than a per-call `Gap`. This models
 * call-graph reachability only; it does not claim that any particular
 * argument or return value is propagated between the two callables.
 */
export interface CallEdge {
  id: EntityId;
  callerId: EntityId;
  calleeId: EntityId;
  callSiteLocation: SourceLocation;
  certainty: Extract<CertaintyCategory, "detected">;
  evidence: Evidence[];
}

export type ExternalDependencyScope = "direct" | "dev" | "peer" | "optional";

export type ExternalDependencyRegistry = "npm" | "pypi";

/**
 * A third-party package declared in a manifest (`package.json` /
 * `pyproject.toml`), distinct from `Relationship`, which is strictly
 * internal (file-to-file) dependency edges. `evidence` carries both the
 * manifest declaration itself and one entry per file that appears to
 * reference it — "used by" is derived by callers from the locations of
 * evidence with kind `"import-reference"`, not stored separately. A
 * `declaredVersion` is the manifest's own version range/spec, never a
 * lockfile-resolved exact version (no lockfile parsing is performed).
 * `description`/`descriptionSource` are optional package metadata fetched
 * from a public registry at analysis time (`src/registry/`) — informational
 * context about the package itself, not an analysis conclusion about this
 * repository, so it's kept out of the Detected/Inferred certainty system.
 * `keywords` is the same kind of registry-sourced metadata, fetched
 * alongside the description.
 */
export interface ExternalDependency {
  id: EntityId;
  projectId: EntityId;
  name: string;
  declaredVersion?: string;
  scope: ExternalDependencyScope;
  registry: ExternalDependencyRegistry;
  description?: string;
  descriptionSource?: ExternalDependencyRegistry;
  keywords?: string[];
  evidence: Evidence[];
  gaps: Gap[];
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
  externalDependencies: ExternalDependency[];
  callableSignatures: CallableSignature[];
  callEdges: CallEdge[];
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
    ...lore.externalDependencies.flatMap((d) => d.evidence),
    ...lore.callableSignatures.flatMap((c) => c.evidence),
    ...lore.callEdges.flatMap((e) => e.evidence),
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
