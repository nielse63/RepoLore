"use client";

import type { AnalysisRunStatus } from "@/db/analysis-runs";
import { trackEvent } from "@/lib/analytics";
import { useEffect } from "react";

/**
 * Reports how a home-page submission's analysis ended (`analysis_completed`,
 * `analysis_partial`, `analysis_failed`) as a GA4 event. The Server Action
 * redirects before the client sees the result, so it marks the redirect with
 * `?submitted=1` and the Overview renders this with the run's status. The
 * marker is then stripped from the address bar so a copied or refreshed URL
 * doesn't report the same submission again — and, since the effect only
 * fires while the marker is present, a re-run (Strict Mode) doesn't either.
 */
export function SubmissionOutcomeEvent({
  status,
}: {
  status: AnalysisRunStatus;
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("submitted")) return;
    trackEvent(`analysis_${status}`);
    url.searchParams.delete("submitted");
    window.history.replaceState(null, "", url);
  }, [status]);

  return null;
}
