import {
  getDelayAfterStage,
  getStageLabel,
} from "@/lib/analysis-loading-stages";
import { useEffect, useState } from "react";

/**
 * The staged loading label to show while a submission's Server Action is
 * pending (`analysis-loading-stages.ts`), restarting from the first stage
 * on each new submission. Shared by the home page form and an unanalyzed
 * repository's "Analyze" button.
 */
export function useAnalysisStageLabel(isPending: boolean): string {
  const [stageIndex, setStageIndex] = useState(0);
  // Resets the stage index whenever a submission starts or finishes, so the
  // next submission narrates from the beginning again. Set during render
  // (React's documented pattern for state that tracks a prop/derived value)
  // rather than in the effect below, which only owns the timer subscription.
  const [prevIsPending, setPrevIsPending] = useState(isPending);
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending);
    setStageIndex(0);
  }

  // Re-schedules on every stageIndex change (rather than a single interval)
  // because the delay isn't constant: it's STAGE_INTERVAL_MS while narrating
  // real phases, then a randomized 30-45s once into REASSURANCE_STAGES.
  useEffect(() => {
    if (!isPending) return;
    const timeoutId = setTimeout(() => {
      setStageIndex((i) => i + 1);
    }, getDelayAfterStage(stageIndex));
    return () => clearTimeout(timeoutId);
  }, [isPending, stageIndex]);

  return getStageLabel(stageIndex);
}
