/**
 * Rate-limits the manual "Refresh history" action per repository, mirroring
 * `src/analysis/reanalysis-rate-limit.ts` exactly — a compute here means a
 * commit-list fetch plus up to `MAX_COMMITS_PER_COMPUTE` per-commit diff
 * fetches against the shared GitHub token, so it needs the same protection
 * against a scripted rapid-click burning through the rate limit.
 */

import { getDbPool } from "@/db/client";

export const HISTORY_REFRESH_COOLDOWN_SECONDS = 60;

export class HistoryRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(`Please wait ${retryAfterSeconds}s before refreshing history again.`);
    this.name = "HistoryRateLimitedError";
  }
}

/** Atomically claims permission to compute history for a repo — same check-and-set shape as `claimReanalysisAttempt`. */
export async function claimHistoryRefresh(repoId: number): Promise<void> {
  const pool = getDbPool();

  const { rows: claimed } = await pool.query<{ id: number }>(
    `UPDATE repos
     SET last_history_requested_at = now()
     WHERE id = $1
       AND (last_history_requested_at IS NULL
            OR last_history_requested_at
                 <= now() - ($2 * interval '1 second'))
     RETURNING id`,
    [repoId, HISTORY_REFRESH_COOLDOWN_SECONDS]
  );
  if (claimed.length > 0) return;

  const { rows } = await pool.query<{ seconds_remaining: number }>(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
        last_history_requested_at + ($2 * interval '1 second') - now()
     ))))::int AS seconds_remaining
     FROM repos
     WHERE id = $1`,
    [repoId, HISTORY_REFRESH_COOLDOWN_SECONDS]
  );
  throw new HistoryRateLimitedError(
    rows[0]?.seconds_remaining ?? HISTORY_REFRESH_COOLDOWN_SECONDS
  );
}
