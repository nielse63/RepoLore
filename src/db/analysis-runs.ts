import type { LoreIndexabilityFacts } from "@/lib/lore-indexability";
import type { Lore } from "@/lore/model";
import { getDbPool } from "./client";

export type AnalysisRunStatus = "completed" | "partial" | "failed";

export interface AnalysisRunRow {
  id: number;
  repoId: number;
  commitSha: string;
  analyzerVersion: string;
  status: AnalysisRunStatus;
  result: Lore | null;
  errorMessage: string | null;
  createdAt: string;
}

interface AnalysisRunRawRow {
  id: string;
  repo_id: string;
  commit_sha: string;
  analyzer_version: string;
  status: AnalysisRunStatus;
  result: Lore | null;
  error_message: string | null;
  created_at: string;
}

/**
 * `result` is a persisted JSONB document, so it only has whatever shape
 * `Lore` had at the time it was written (ADR-0005: an old run is never
 * migrated or backfilled, only superseded by a new run at a bumped analyzer
 * version). `externalDependencies` (ADR-0011), `callableSignatures`/
 * `callEdges` (ADR-0012), and `behaviorNodes`/`behaviorEdges`/
 * `functionImportance` (ADR-0013) were each added to `Lore` after runs
 * already existed in the database, so a pre-existing row's stored JSON may
 * not have them — normalized here, once, at the read boundary, rather than
 * defensively in every consumer.
 */
function normalizeResult(result: Lore | null): Lore | null {
  if (!result) return result;
  return {
    ...result,
    externalDependencies: result.externalDependencies ?? [],
    callableSignatures: result.callableSignatures ?? [],
    callEdges: result.callEdges ?? [],
    behaviorNodes: result.behaviorNodes ?? [],
    behaviorEdges: result.behaviorEdges ?? [],
    functionImportance: result.functionImportance ?? [],
  };
}

function mapRow(row: AnalysisRunRawRow): AnalysisRunRow {
  return {
    id: Number(row.id),
    repoId: Number(row.repo_id),
    commitSha: row.commit_sha,
    analyzerVersion: row.analyzer_version,
    status: row.status,
    result: normalizeResult(row.result),
    errorMessage: row.error_message,
    createdAt: row.created_at,
  };
}

export interface SaveAnalysisRunParams {
  repoId: number;
  commitSha: string;
  analyzerVersion: string;
  status: AnalysisRunStatus;
  result?: Lore;
  errorMessage?: string;
}

/**
 * Idempotent on `(repo_id, commit_sha, analyzer_version)` (ADR-0005): if a
 * run already exists for that key, the existing row is returned unchanged
 * rather than duplicated or overwritten — a run is an immutable record of
 * what a specific analyzer version produced for a specific commit.
 */
export async function saveAnalysisRun(
  params: SaveAnalysisRunParams
): Promise<AnalysisRunRow> {
  const pool = getDbPool();
  const { rows } = await pool.query<AnalysisRunRawRow>(
    `INSERT INTO analysis_runs
       (repo_id, commit_sha, analyzer_version, status, result, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (repo_id, commit_sha, analyzer_version) DO NOTHING
     RETURNING id, repo_id, commit_sha, analyzer_version, status, result, error_message, created_at`,
    [
      params.repoId,
      params.commitSha,
      params.analyzerVersion,
      params.status,
      params.result ? JSON.stringify(params.result) : null,
      params.errorMessage ?? null,
    ]
  );
  if (rows.length > 0) return mapRow(rows[0]);

  const existing = await getAnalysisRunByKey(
    params.repoId,
    params.commitSha,
    params.analyzerVersion
  );
  if (!existing) {
    throw new Error(
      `saveAnalysisRun: insert was skipped as a conflict but no existing row was found for repo ${params.repoId}@${params.commitSha}/${params.analyzerVersion}.`
    );
  }
  return existing;
}

/** Exact-key lookup, any status — used to short-circuit re-analysis at an already-run commit+version. */
export async function getAnalysisRunByKey(
  repoId: number,
  commitSha: string,
  analyzerVersion: string
): Promise<AnalysisRunRow | null> {
  const pool = getDbPool();
  const { rows } = await pool.query<AnalysisRunRawRow>(
    `SELECT id, repo_id, commit_sha, analyzer_version, status, result, error_message, created_at
     FROM analysis_runs
     WHERE repo_id = $1 AND commit_sha = $2 AND analyzer_version = $3`,
    [repoId, commitSha, analyzerVersion]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface LatestRunIndexabilityRow extends LoreIndexabilityFacts {
  owner: string;
  repo: string;
  /** `pg` parses `TIMESTAMPTZ` into a `Date`. */
  createdAt: Date;
}

/**
 * Every repository's latest run (the one its page renders), projected to
 * just the facts `isIndexableLore` needs, so `sitemap.ts` doesn't load each
 * run's full `result` JSONB. A `'failed'` run has a null `result`, so its
 * counts come back 0 rather than null.
 */
export async function listLatestRunIndexabilityFacts(): Promise<
  LatestRunIndexabilityRow[]
> {
  const pool = getDbPool();
  const { rows } = await pool.query<{
    owner: string;
    name: string;
    status: AnalysisRunStatus;
    entry_point_count: number;
    structural_area_count: number;
    is_private: boolean;
    created_at: Date;
  }>(
    `SELECT DISTINCT ON (ar.repo_id)
       r.owner, r.name, ar.status, ar.created_at,
       COALESCE(jsonb_array_length(ar.result->'entryPoints'), 0)::int AS entry_point_count,
       COALESCE(jsonb_array_length(ar.result->'structuralAreas'), 0)::int AS structural_area_count,
       COALESCE((ar.result->'snapshot'->'repository'->>'isPrivate')::boolean, false) AS is_private
     FROM analysis_runs ar
     JOIN repos r ON r.id = ar.repo_id
     ORDER BY ar.repo_id, ar.created_at DESC`
  );
  return rows.map((row) => ({
    owner: row.owner,
    repo: row.name,
    runStatus: row.status,
    entryPointCount: row.entry_point_count,
    structuralAreaCount: row.structural_area_count,
    isPrivate: row.is_private,
    createdAt: row.created_at,
  }));
}

/**
 * The most recent run for a repository, regardless of status — a repo whose
 * latest attempt failed must still render that failure honestly rather than
 * appearing as "never analyzed."
 */
export async function getLatestAnalysisRunForRepo(
  owner: string,
  repo: string
): Promise<AnalysisRunRow | null> {
  const pool = getDbPool();
  const { rows } = await pool.query<AnalysisRunRawRow>(
    `SELECT ar.id, ar.repo_id, ar.commit_sha, ar.analyzer_version, ar.status, ar.result, ar.error_message, ar.created_at
     FROM analysis_runs ar
     JOIN repos r ON r.id = ar.repo_id
     WHERE r.owner = $1 AND r.name = $2
     ORDER BY ar.created_at DESC
     LIMIT 1`,
    [owner, repo]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
