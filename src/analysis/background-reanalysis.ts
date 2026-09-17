import { reanalyzeAndRefreshHistory } from "@/analysis/reanalyze-and-refresh-history";
import { RateLimitedError } from "@/analysis/reanalysis-rate-limit";
import isAnalysisStale from "@/helpers/is-analysis-stale";
import { after } from "next/server";

/**
 * Schedules a background re-analysis attempt (ADR-0013, GitHub issue #12)
 * when `analyzedAt` is stale — pull-triggered by an actual page view, never
 * headless/scheduled: called from a request that's already happening, and a
 * no-op if nobody ever visits a stale repository. Runs via `after()` so the
 * triggering request's own response isn't slowed by a possible tarball
 * fetch/extraction. Uses the same `reanalyzeAndRefreshHistory` path the
 * manual "Re-analyze" button uses (not `analyzeAndPersistRepository`
 * directly), so a new run produced here also keeps the History page's cache
 * in sync (GitHub issue #13) rather than reopening that bug through a new
 * trigger. Its own `claimReanalysisAttempt` guard means simultaneous
 * visitors to the same stale repo don't each start a redundant attempt —
 * only the first claims it; every other concurrent attempt (this one or a
 * manual click) throws `RateLimitedError`, silently discarded here since
 * nothing is waiting on this specific response. `revalidatePath` is
 * deliberately not called here — see ADR-0013.
 */
export function scheduleBackgroundReanalysisIfStale(
  owner: string,
  repo: string,
  analyzedAt: string
): void {
  if (!isAnalysisStale(analyzedAt)) return;

  after(async () => {
    try {
      await reanalyzeAndRefreshHistory(owner, repo);
    } catch (error) {
      if (error instanceof RateLimitedError) return;
      console.error(
        `Background re-analysis for ${owner}/${repo} failed:`,
        error
      );
    }
  });
}
