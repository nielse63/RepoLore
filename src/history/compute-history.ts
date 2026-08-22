/**
 * Orchestrates the History page's data path: list recent commits, fetch
 * each one's diff, classify them against the latest persisted analysis
 * (`Lore`), and group/describe the result. Mirrors
 * `src/analysis/analyze-and-persist.ts`'s "run synchronously, persist the
 * honest result" shape (ADR-0004), but is intentionally a separate code
 * path — it never re-runs the structural analyzer, only reads its latest
 * persisted output for area resolution.
 */

import { buildHistoryEntries } from "./classify";
import type { HistoryEntry } from "./model";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import {
  HISTORY_LOOKBACK_DAYS,
  fetchCommitDetail,
  listCommitsSince,
  type CommitDetail,
  type CommitSummary,
} from "@/github/commits";

const DETAIL_FETCH_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
  return results;
}

export interface ComputeHistoryResult {
  entries: HistoryEntry[];
  computedThroughSha: string;
  /** True when more commits exist in the lookback window than were fetched. */
  truncated: boolean;
}

/**
 * Requires a completed real analysis run to already exist (for `Lore`-based
 * area resolution) — a repo with no successful run yet gets an empty,
 * honest result rather than a fabricated one.
 */
export async function computeHistory(
  owner: string,
  repo: string
): Promise<ComputeHistoryResult> {
  const run = await getLatestAnalysisRunForRepo(owner, repo);
  if (!run || !run.result) {
    return { entries: [], computedThroughSha: "", truncated: false };
  }
  const lore = run.result;
  const branch = lore.snapshot.repository.defaultBranch;
  const since = new Date(
    Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );

  const { commits, truncated } = await listCommitsSince(owner, repo, {
    branch,
    since,
  });

  const commitDetails: { commit: CommitSummary; detail: CommitDetail }[] =
    await mapWithConcurrency(
      commits,
      DETAIL_FETCH_CONCURRENCY,
      async (commit) => ({
        commit,
        detail: await fetchCommitDetail(owner, repo, commit.sha),
      })
    );

  const entries = buildHistoryEntries(commitDetails, lore);
  return { entries, computedThroughSha: lore.snapshot.commitSha, truncated };
}
