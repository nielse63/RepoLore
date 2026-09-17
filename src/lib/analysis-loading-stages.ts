/**
 * Simulated stage labels shown while `analyzeAndPersistRepository` runs
 * (`src/analysis/analyze-and-persist.ts`) — there's no real progress channel
 * from that single awaited Server Action call back to the client, so this is
 * a best-effort narration of its actual phases (acquire source, run
 * analyzer(s), persist).
 */
export const ANALYSIS_STAGES = [
  "Fetching repository source…",
  "Analyzing code…",
  "Building your Lore…",
];

/**
 * Shown on a loop, at a randomized 30-45s cadence, once ANALYSIS_STAGES is
 * exhausted — analysis can run a minute or two past "Building your Lore…",
 * and the fixed narration above has no more real phases left to describe.
 * These are deliberately generic (no further progress signal exists) and
 * exist only so the last real stage doesn't sit on screen long enough to
 * look stuck.
 */
export const REASSURANCE_STAGES = [
  "Still working…",
  "This can take a minute or two…",
  "Almost there…",
];

export const STAGE_INTERVAL_MS = 2500;
export const REASSURANCE_MIN_MS = 30_000;
export const REASSURANCE_MAX_MS = 45_000;

/** The label for the given stage index, looping through REASSURANCE_STAGES indefinitely past ANALYSIS_STAGES. */
export function getStageLabel(index: number): string {
  if (index < ANALYSIS_STAGES.length) return ANALYSIS_STAGES[index];
  const reassuranceIndex =
    (index - ANALYSIS_STAGES.length) % REASSURANCE_STAGES.length;
  return REASSURANCE_STAGES[reassuranceIndex];
}

/** How long to wait before advancing from the given stage index to the next one. */
export function getDelayAfterStage(index: number): number {
  if (index < ANALYSIS_STAGES.length - 1) return STAGE_INTERVAL_MS;
  return (
    REASSURANCE_MIN_MS +
    Math.random() * (REASSURANCE_MAX_MS - REASSURANCE_MIN_MS)
  );
}
