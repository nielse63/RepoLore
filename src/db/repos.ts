import { getDbPool } from "./client";

export interface RepoRow {
  id: number;
  owner: string;
  name: string;
  createdAt: string;
}

interface RepoRawRow {
  id: string;
  owner: string;
  name: string;
  created_at: string;
}

function mapRow(row: RepoRawRow): RepoRow {
  return {
    id: Number(row.id),
    owner: row.owner,
    name: row.name,
    createdAt: row.created_at,
  };
}

/**
 * Inserts a repo row if one doesn't already exist for `(owner, name)`, and
 * always returns it either way — an upsert, not a plain insert, since
 * `resolveRepositoryHead` is checked on every submission regardless of
 * whether the repo's been seen before.
 */
export async function upsertRepo(
  owner: string,
  name: string
): Promise<RepoRow> {
  const pool = getDbPool();
  const { rows } = await pool.query<RepoRawRow>(
    `INSERT INTO repos (owner, name)
     VALUES ($1, $2)
     ON CONFLICT (owner, name) DO UPDATE SET owner = EXCLUDED.owner
     RETURNING id, owner, name, created_at`,
    [owner, name]
  );
  return mapRow(rows[0]);
}

/**
 * Like `upsertRepo`, but for GitHub's canonical spelling of a repository
 * (`resolveRepositoryHead`'s `owner`/`repo`), so a repository analyzed under
 * different letter case keeps one row (GitHub issue #43): an existing row
 * that matches case-insensitively is adopted and re-spelled to the
 * canonical case — keeping its runs, history, and rate-limit state — rather
 * than a second row inserted beside it. An exact match is preferred, then a
 * row that has runs, so pre-existing case duplicates resolve to one row
 * without violating `UNIQUE (owner, name)`.
 */
export async function upsertCanonicalRepo(
  owner: string,
  name: string
): Promise<RepoRow> {
  const pool = getDbPool();
  const { rows: adopted } = await pool.query<RepoRawRow>(
    `UPDATE repos
     SET owner = $1, name = $2
     WHERE id = (
       SELECT r.id FROM repos r
       WHERE lower(r.owner) = lower($1) AND lower(r.name) = lower($2)
       ORDER BY (r.owner = $1 AND r.name = $2) DESC,
                EXISTS (SELECT 1 FROM analysis_runs ar WHERE ar.repo_id = r.id) DESC,
                r.id
       LIMIT 1
     )
     RETURNING id, owner, name, created_at`,
    [owner, name]
  );
  if (adopted[0]) return mapRow(adopted[0]);
  return upsertRepo(owner, name);
}

/**
 * DB-only, case-insensitive lookup of the stored spelling of a repository
 * — no GitHub call, so it's safe on every page view (ADR-0017). Prefers a
 * row that has been analyzed, then an exact match, so a URL spelled
 * differently from the analyzed row finds that row.
 */
export async function findRepoIgnoringCase(
  owner: string,
  name: string
): Promise<RepoRow | null> {
  const pool = getDbPool();
  const { rows } = await pool.query<RepoRawRow>(
    `SELECT r.id, r.owner, r.name, r.created_at
     FROM repos r
     WHERE lower(r.owner) = lower($1) AND lower(r.name) = lower($2)
     ORDER BY EXISTS (SELECT 1 FROM analysis_runs ar WHERE ar.repo_id = r.id) DESC,
              (r.owner = $1 AND r.name = $2) DESC,
              r.id
     LIMIT 1`,
    [owner, name]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
