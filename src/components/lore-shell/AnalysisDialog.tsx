"use client";

import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import { listItemKey } from "@/lib/list-item-key";
import { relativeTime } from "@/lib/relative-time";
import type { AnalysisSources } from "@/lore/analysis-sources";
import type { CertaintyCategory, Gap } from "@/lore/model";
import { ExternalLink } from "lucide-react";

/** The latest run, as the layout passes it to the shell (serializable). */
export interface ShellAnalysis {
  status: "completed" | "partial" | "failed";
  commitSha: string;
  /** Absent when a failed run produced no result to read it from. */
  branch?: string;
  /** When the analysis ran (or, for a failed run, when it was attempted). */
  analyzedAt: string;
  analyzerVersion: string;
  /** Absent for a failed run. */
  sources?: AnalysisSources;
  gaps: Gap[];
  errorMessage?: string;
}

/**
 * Every certainty category the Lore uses, worded after docs/MODEL_OUTPUT.md
 * ("Evidence and Gaps"). Shown in full, without hover, so a reader can
 * interpret any pill on any page.
 */
const CERTAINTY_LEGEND: { certainty: CertaintyCategory; meaning: string }[] = [
  {
    certainty: "detected",
    meaning:
      "Directly supported by deterministic evidence: an import, export, declaration, or resolved call.",
  },
  {
    certainty: "inferred",
    meaning:
      "An interpretation of detected evidence, from an explicit heuristic or a combination of signals: a grouping or a suggested starting point.",
  },
  {
    certainty: "unknown",
    meaning:
      "The evidence doesn't establish the answer, such as what actually runs at runtime.",
  },
  {
    certainty: "unsupported",
    meaning:
      "Outside the analyzer's current language, framework, or repository-shape support.",
  },
];

const STATUS_LABEL: Record<ShellAnalysis["status"], string> = {
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
};

function SourceList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">
        {items.length > 0 ? (
          <span className="font-mono text-xs [overflow-wrap:anywhere]">
            {items.join(", ")}
          </span>
        ) : (
          "None detected"
        )}
      </dd>
    </div>
  );
}

/**
 * Analysis details for the Lore (issue #84, replacing the always-open
 * Analysis rail): the analyzed snapshot, what the findings were derived
 * from, how to read each certainty category, the recorded gaps, and the
 * existing Re-analyze action.
 */
export function AnalysisDialog({
  owner,
  repo,
  analysis,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  owner: string;
  repo: string;
  analysis: ShellAnalysis;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { gaps, sources } = analysis;
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${analysis.commitSha}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="Close analysis details"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <p className="text-2xs font-medium uppercase tracking-widest text-primary">
          Repository analysis
        </p>
        <DialogTitle className="mt-1 pr-12 font-serif text-2xl text-foreground">
          Analysis details
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          What this Lore was built from, and how to read its findings.
        </DialogDescription>

        <section aria-labelledby="analysis-snapshot-heading" className="mt-6">
          <h3
            id="analysis-snapshot-heading"
            className="text-sm font-semibold text-foreground"
          >
            Snapshot
          </h3>
          <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Status</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {STATUS_LABEL[analysis.status]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Branch</dt>
              <dd className="mt-0.5 text-sm text-foreground [overflow-wrap:anywhere]">
                {analysis.branch ?? "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Commit</dt>
              <dd className="mt-0.5">
                <a
                  href={commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                >
                  {analysis.commitSha.slice(0, 7)}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">
                {analysis.status === "failed" ? "Attempted" : "Analyzed"}
              </dt>
              <dd className="mt-0.5 text-sm text-foreground">
                <time
                  dateTime={analysis.analyzedAt}
                  // Pinned locale and timezone, so server and browser
                  // render the same text (see HistoryContent).
                  title={new Date(analysis.analyzedAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "UTC",
                    timeZoneName: "short",
                  })}
                >
                  {relativeTime(analysis.analyzedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Analyzer version</dt>
              <dd className="mt-0.5 font-mono text-xs text-foreground">
                {analysis.analyzerVersion}
              </dd>
            </div>
          </dl>
          {analysis.status === "failed" && (
            <p
              role="alert"
              className="mt-3 rounded-md bg-tile-alert-bg p-3 text-sm text-tile-alert-fg"
            >
              {analysis.errorMessage ?? "Unknown error."}
            </p>
          )}
        </section>

        {sources && (
          <section aria-labelledby="analysis-sources-heading" className="mt-6">
            <h3
              id="analysis-sources-heading"
              className="text-sm font-semibold text-foreground"
            >
              Evidence sources
            </h3>
            <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SourceList label="Languages" items={sources.languages} />
              <SourceList label="Frameworks" items={sources.frameworks} />
              <SourceList label="Manifests" items={sources.manifests} />
            </dl>
          </section>
        )}

        <section aria-labelledby="analysis-legend-heading" className="mt-6">
          <h3
            id="analysis-legend-heading"
            className="text-sm font-semibold text-foreground"
          >
            How to read the findings
          </h3>
          <dl className="mt-2 space-y-2.5">
            {CERTAINTY_LEGEND.map(({ certainty, meaning }) => (
              <div key={certainty} className="flex items-start gap-3">
                <dt className="w-24 shrink-0">
                  <CertaintyBadge certainty={certainty} />
                </dt>
                <dd className="text-sm text-muted">{meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        {analysis.status !== "failed" && (
          <section aria-labelledby="analysis-gaps-heading" className="mt-6">
            <h3
              id="analysis-gaps-heading"
              className="text-sm font-semibold text-foreground"
            >
              Gaps and limitations
            </h3>
            <p className="mt-1 text-sm text-muted">
              {gaps.length === 0
                ? "No gaps or limitations were recorded for this analysis."
                : `This analysis recorded ${gaps.length} gap${gaps.length === 1 ? "" : "s"} or limitation${gaps.length === 1 ? "" : "s"}.`}
            </p>
            {gaps.length > 0 && (
              <ul
                tabIndex={0}
                aria-label="Recorded gaps"
                className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3 text-sm focus-visible:outline-2 focus-visible:outline-primary"
              >
                {gaps.map((gap, i) => (
                  <li key={listItemKey(i)} className="flex items-start gap-2">
                    <CertaintyBadge certainty={gap.certainty} />
                    <span className="text-foreground [overflow-wrap:anywhere]">
                      {gap.description}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <ReanalyzeButton owner={owner} repo={repo} align="start" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
