"use client";

import { Card } from "@/components/ui/Card";
import { relativeTime } from "@/lib/relative-time";
import { Clock, X } from "lucide-react";
import { useState } from "react";

/**
 * Dismissible notice that the latest analysis is more than a day old
 * (GitHub issue #12) and a background re-analysis attempt has already been
 * scheduled for this visit (ADR-0013, `scheduleBackgroundReanalysisIfStale`,
 * called from this route's `layout.tsx`) — this card is informational, not
 * a call to action. The manual "Re-analyze" button stays available for a
 * visitor who doesn't want to wait for the background attempt or a reload.
 */
export function StaleAnalysisCard({ analyzedAt }: { analyzedAt: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <section id="stale-analysis-card">
      <Card className="bg-tile-supporting-bg">
        <div className="flex items-start justify-between gap-4">
          <p className="flex items-center text-sm text-tile-supporting-fg">
            <Clock className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            <strong>Analyzed {relativeTime(analyzedAt)}.</strong>
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="text-tile-supporting-fg hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm text-tile-supporting-fg">
          Checking for a newer commit in the background — reload in a moment to
          see updated results, or use <strong>Re-analyze</strong> above to check
          right now.
        </p>
      </Card>
    </section>
  );
}
