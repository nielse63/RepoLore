/**
 * Rate-limits analysis attempts per repository (acceptance criterion 11).
 * Gates every attempt at the point it's requested — before the GitHub API
 * calls that resolve HEAD — not just the tarball fetch/extraction that
 * ADR-0005's idempotency already skips at an unchanged commit. A tunable,
 * disclosed default (`REANALYSIS_COOLDOWN_SECONDS`), not a load-bearing
 * design decision, matching the precedent set by `DEFAULT_EXTRACTION_LIMITS`
 * (session 8).
 */

import { getDbPool } from "@/db/client";

export const REANALYSIS_COOLDOWN_SECONDS = 60;

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Please wait ${retryAfterSeconds}s before analyzing this repository again.`
    );
    this.name = "RateLimitedError";
  }
}

/**
 * Atomically claims permission to attempt analysis for a repo. The `UPDATE
 * ... WHERE ... RETURNING` is a single round trip, so two concurrent
 * attempts can't both read "not rate-limited" before either writes — the
 * database's row-level locking makes the check-and-set atomic. Throws
 * `RateLimitedError` (with how long to wait) if a claim was made too
 * recently, rather than silently no-oping.
 */
export async function claimReanalysisAttempt(repoId: number): Promise<void> {
  const pool = getDbPool();

  const { rows: claimed } = await pool.query<{ id: number }>(
    `UPDATE repos
     SET last_analysis_requested_at = now()
     WHERE id = $1
       AND (last_analysis_requested_at IS NULL
            OR last_analysis_requested_at
                 <= now() - ($2 * interval '1 second'))
     RETURNING id`,
    [repoId, REANALYSIS_COOLDOWN_SECONDS]
  );
  if (claimed.length > 0) return;

  const { rows } = await pool.query<{ seconds_remaining: number }>(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
        last_analysis_requested_at + ($2 * interval '1 second') - now()
     ))))::int AS seconds_remaining
     FROM repos
     WHERE id = $1`,
    [repoId, REANALYSIS_COOLDOWN_SECONDS]
  );
  throw new RateLimitedError(
    rows[0]?.seconds_remaining ?? REANALYSIS_COOLDOWN_SECONDS
  );
}
