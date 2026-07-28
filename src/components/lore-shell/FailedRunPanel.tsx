import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { TopBar } from "@/components/lore-shell/TopBar";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { Card } from "@/components/ui/Card";
import { relativeTime } from "@/lib/relative-time";
import type { AnalysisRunRow } from "@/db/analysis-runs";

/**
 * Shared honest "analysis failed" rendering for any `/lore/{owner}/{repo}/*`
 * page that reads the latest run directly (acceptance criterion 2) — a
 * failed or resultless run must never look like "not found" or a partial
 * success.
 */
export function FailedRunPanel({
  owner,
  repo,
  run,
}: {
  owner: string;
  repo: string;
  run: Pick<
    AnalysisRunRow,
    "commitSha" | "analyzerVersion" | "createdAt" | "errorMessage"
  >;
}) {
  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel="Analysis failed"
              statusTone="alert"
              updatedLabel={relativeTime(run.createdAt)}
              branch="—"
            />
          }
          actions={<ReanalyzeButton owner={owner} repo={repo} />}
        />
      }
    >
      <div className="max-w-2xl">
        <h1 className="font-serif text-3xl font-semibold text-foreground">
          Analysis failed
        </h1>
        <p className="mt-2 text-sm text-muted">
          Analysis failed for commit{" "}
          <code className="font-mono">{run.commitSha}</code> (analyzer{" "}
          {run.analyzerVersion}, {new Date(run.createdAt).toLocaleString()}).
        </p>
        <Card
          className="mt-4 border-tile-alert-fg/30 bg-tile-alert-bg"
          role="alert"
        >
          <p className="text-sm text-tile-alert-fg">
            {run.errorMessage ?? "Unknown error."}
          </p>
        </Card>
      </div>
    </LorePageFrame>
  );
}
