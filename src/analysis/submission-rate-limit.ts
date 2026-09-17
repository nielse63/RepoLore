/**
 * Rate-limits the home page's repository-submission form per caller
 * (src/lib/request-identifier.ts), independent of `reanalysis-rate-limit.ts`'s
 * per-repo cooldown. That cooldown only throttles repeat submissions of the
 * *same* repo; without this, a single caller could submit many *different*
 * repository URLs in quick succession with no limit, each one still costing
 * a GitHub API resolve (and, for a supported language, a full tarball
 * fetch/extraction) against the app's single shared GITHUB_TOKEN. A tunable,
 * disclosed default, matching the precedent set by
 * `REANALYSIS_COOLDOWN_SECONDS` — shorter, since this only needs to break up
 * a scripted burst, not protect an already-analyzed commit from redundant
 * re-work.
 */

import { getDbPool } from "@/db/client";

export const SUBMISSION_COOLDOWN_SECONDS = 10;

export class SubmissionRateLimitedError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Please wait ${retryAfterSeconds}s before submitting another repository.`
    );
    this.name = "SubmissionRateLimitedError";
  }
}

/**
 * Atomically claims permission for `identifier` to submit a repository. The
 * `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` is a single round trip
 * that only updates (and returns) the row when the cooldown has elapsed, so
 * two concurrent submissions from the same caller can't both read
 * "not rate-limited" before either writes. Throws `SubmissionRateLimitedError`
 * (with how long to wait) otherwise, rather than silently no-oping.
 */
export async function claimSubmissionAttempt(
  identifier: string
): Promise<void> {
  const pool = getDbPool();

  const { rows: claimed } = await pool.query<{ identifier: string }>(
    `INSERT INTO submission_rate_limits (identifier, last_submitted_at)
     VALUES ($1, now())
     ON CONFLICT (identifier) DO UPDATE
       SET last_submitted_at = now()
       WHERE submission_rate_limits.last_submitted_at
               <= now() - ($2 * interval '1 second')
     RETURNING identifier`,
    [identifier, SUBMISSION_COOLDOWN_SECONDS]
  );
  if (claimed.length > 0) return;

  const { rows } = await pool.query<{ seconds_remaining: number }>(
    `SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (
        last_submitted_at + ($2 * interval '1 second') - now()
     ))))::int AS seconds_remaining
     FROM submission_rate_limits
     WHERE identifier = $1`,
    [identifier, SUBMISSION_COOLDOWN_SECONDS]
  );
  throw new SubmissionRateLimitedError(
    rows[0]?.seconds_remaining ?? SUBMISSION_COOLDOWN_SECONDS
  );
}
