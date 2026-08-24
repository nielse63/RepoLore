import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { AnalysisRail } from "@/components/lore-shell/AnalysisRail";
import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { OverviewContent } from "@/components/lore-shell/OverviewContent";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { TopBar } from "@/components/lore-shell/TopBar";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import { getAnalysisStatus } from "@/helpers";
import { relativeTime } from "@/lib/relative-time";
import type { SourceLocation } from "@/lore/model";
import { notFound } from "next/navigation";

/**
 * Renders the latest persisted analysis run for a repository (acceptance
 * criterion 10). Not a static/cached page — always reads the current
 * latest run, so a re-analysis (session 11) is visible on next load without
 * a redeploy. A `'failed'` run is rendered honestly, with its error, rather
 * than presented as "not found."
 */
export default async function LorePage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const run = await getLatestAnalysisRunForRepo(owner, repo);
  if (!run) notFound();

  if (run.status === "failed" || !run.result) {
    return <FailedRunPanel owner={owner} repo={repo} run={run} />;
  }

  const lore = run.result;
  // A mixed-language repository (ADR-0007) can have more than one project —
  // aggregate across all of them rather than reading only the first, so a
  // second detected language isn't silently hidden.
  const languages = [
    ...new Set(lore.projects.flatMap((p) => p.languages)),
  ].join(", ");
  const sourceUrl = (location: SourceLocation) =>
    githubBlobUrl(owner, repo, lore.snapshot.commitSha, location);
  const areaUrl = (location: SourceLocation) =>
    githubTreeUrl(owner, repo, lore.snapshot.commitSha, location);

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel={getAnalysisStatus(lore)}
              statusTone={
                lore.snapshot.status === "completed" ? "success" : "alert"
              }
              updatedLabel={`Analyzed ${relativeTime(lore.snapshot.analyzedAt)}`}
              branch={lore.snapshot.repository.defaultBranch}
              language={languages}
            />
          }
          actions={<ReanalyzeButton owner={owner} repo={repo} />}
        />
      }
      rightRail={
        <AnalysisRail
          snapshot={lore.snapshot}
          projects={lore.projects}
          gaps={lore.gaps}
        />
      }
    >
      <OverviewContent lore={lore} sourceUrl={sourceUrl} areaUrl={areaUrl} />
    </LorePageFrame>
  );
}
