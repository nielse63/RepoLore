"use client";

import { useLoreShell } from "@/components/lore-shell/LoreShellContext";

/**
 * The status line under each Lore page heading (issue #84): the analyzed
 * commit and branch, and a way into the Analysis dialog. It names the
 * snapshot rather than calling it current, since freshness isn't checked
 * here.
 */
export function LoreStatusLine() {
  const { analysis, openDialog } = useLoreShell();

  return (
    <div
      id="status-line"
      className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-primary"
        />
        <span>
          Analyzed commit{" "}
          <code
            className="font-mono text-foreground"
            title={analysis.commitSha}
          >
            {analysis.commitSha.slice(0, 7)}
          </code>
        </span>
      </span>
      {analysis.branch && (
        <span className="whitespace-nowrap">
          <span aria-hidden="true">· </span>
          {analysis.branch}
        </span>
      )}
      <span className="whitespace-nowrap">
        <span aria-hidden="true">· </span>
        <button
          type="button"
          onClick={(e) => openDialog("analysis", e.currentTarget)}
          className="text-primary underline underline-offset-4 hover:no-underline"
        >
          Analysis details
        </button>
      </span>
    </div>
  );
}
