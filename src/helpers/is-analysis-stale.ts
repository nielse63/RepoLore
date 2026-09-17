export const STALE_ANALYSIS_THRESHOLD_SECONDS = 60 * 60 * 24;

/**
 * Whether the most recent analysis is old enough to nudge the user toward
 * re-analyzing (GitHub issue #12's first guard: an analysis under a day old
 * is never considered stale). Does not itself trigger anything — the actual
 * re-analysis, including the "did the default branch's HEAD commit even
 * change" guard, stays behind the existing manual "Re-analyze" action, per
 * docs/product/non-goals.md's "no scheduled refresh".
 */
export default function isAnalysisStale(
  analyzedAt: string,
  now: Date = new Date()
): boolean {
  const ageSeconds = (now.getTime() - new Date(analyzedAt).getTime()) / 1000;
  return ageSeconds >= STALE_ANALYSIS_THRESHOLD_SECONDS;
}
