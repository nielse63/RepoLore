import { analyzeAndPersistRepository } from "@/analysis/analyze-and-persist";
import {
  getLatestAnalysisRunForRepo,
  type AnalysisRunRow,
} from "@/db/analysis-runs";
import { saveHistoryEntries } from "@/db/history-entries";
import { upsertRepo } from "@/db/repos";
import { computeHistory } from "@/history/compute-history";

export interface ReanalyzeResult {
  run: AnalysisRunRow;
  /** Whether analysis produced a new run (not ADR-0005's idempotent short-circuit on an unchanged commit). */
  changed: boolean;
  /** Whether History's cache was actually recomputed and saved — `false` when `changed` is `false`, or when a recompute was attempted but failed. */
  historyRefreshed: boolean;
}

/**
 * Re-analyzes a repository and, only when that actually produced a new run,
 * also recomputes and re-caches the History page's `history_entries` row —
 * otherwise History keeps showing entries computed against the previous
 * analysis until someone separately triggers a refresh (GitHub issue #13).
 * Shared by the manual "Re-analyze" Server Action (`src/app/actions.ts`) and
 * the pull-triggered background re-analysis (ADR-0013,
 * `src/analysis/background-reanalysis.ts`), so every path that can produce
 * a new analysis run keeps History in sync the same way. A history-recompute
 * failure is logged, not thrown — the re-analysis itself already succeeded
 * independently. This deliberately bypasses History's own 60-second cooldown
 * (`src/history/history-rate-limit.ts`), since it's a direct consequence of
 * an already-rate-limited re-analysis (`claimReanalysisAttempt`), not a
 * manual refresh click.
 */
export async function reanalyzeAndRefreshHistory(
  owner: string,
  repo: string
): Promise<ReanalyzeResult> {
  const previousRun = await getLatestAnalysisRunForRepo(owner, repo);
  const run = await analyzeAndPersistRepository(owner, repo);
  const changed = run.id !== previousRun?.id;
  let historyRefreshed = false;

  if (changed) {
    try {
      const repoRow = await upsertRepo(owner, repo);
      const { entries, computedThroughSha } = await computeHistory(owner, repo);
      await saveHistoryEntries({
        repoId: repoRow.id,
        computedThroughSha,
        entries,
      });
      historyRefreshed = true;
    } catch (error) {
      console.error(
        `reanalyzeAndRefreshHistory(${owner}/${repo}): history refresh failed:`,
        error
      );
    }
  }

  return { run, changed, historyRefreshed };
}
