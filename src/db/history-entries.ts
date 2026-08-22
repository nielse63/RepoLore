import type { HistoryEntry } from "@/history/model";
import { getDbPool } from "./client";

export interface HistoryEntriesRow {
  id: number;
  repoId: number;
  computedThroughSha: string;
  entries: HistoryEntry[];
  computedAt: string;
}

interface HistoryEntriesRawRow {
  id: string;
  repo_id: string;
  computed_through_sha: string;
  entries: HistoryEntry[];
  computed_at: string;
}

function mapRow(row: HistoryEntriesRawRow): HistoryEntriesRow {
  return {
    id: Number(row.id),
    repoId: Number(row.repo_id),
    computedThroughSha: row.computed_through_sha,
    entries: row.entries,
    computedAt: row.computed_at,
  };
}

/** The cached History compute for a repo, or null if it's never been computed. */
export async function getHistoryEntriesForRepo(
  repoId: number
): Promise<HistoryEntriesRow | null> {
  const pool = getDbPool();
  const { rows } = await pool.query<HistoryEntriesRawRow>(
    `SELECT id, repo_id, computed_through_sha, entries, computed_at
     FROM history_entries
     WHERE repo_id = $1`,
    [repoId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Same as `getHistoryEntriesForRepo`, looked up by `(owner, name)` — mirrors `getLatestAnalysisRunForRepo`'s join, for callers that only have the repo's identity, not its id. */
export async function getHistoryEntriesForRepoByName(
  owner: string,
  repo: string
): Promise<HistoryEntriesRow | null> {
  const pool = getDbPool();
  const { rows } = await pool.query<HistoryEntriesRawRow>(
    `SELECT h.id, h.repo_id, h.computed_through_sha, h.entries, h.computed_at
     FROM history_entries h
     JOIN repos r ON r.id = h.repo_id
     WHERE r.owner = $1 AND r.name = $2`,
    [owner, repo]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export interface SaveHistoryEntriesParams {
  repoId: number;
  computedThroughSha: string;
  entries: HistoryEntry[];
}

/** Upserts the single cached row for `repoId` — a cache, not an immutable history of computes. */
export async function saveHistoryEntries(
  params: SaveHistoryEntriesParams
): Promise<HistoryEntriesRow> {
  const pool = getDbPool();
  const { rows } = await pool.query<HistoryEntriesRawRow>(
    `INSERT INTO history_entries (repo_id, computed_through_sha, entries)
     VALUES ($1, $2, $3)
     ON CONFLICT (repo_id) DO UPDATE
       SET computed_through_sha = EXCLUDED.computed_through_sha,
           entries = EXCLUDED.entries,
           computed_at = now()
     RETURNING id, repo_id, computed_through_sha, entries, computed_at`,
    [params.repoId, params.computedThroughSha, JSON.stringify(params.entries)]
  );
  return mapRow(rows[0]);
}
