import { FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { TopBar } from "@/components/lore-shell/TopBar";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { ArchitectureContent } from "@/components/lore-shell/ArchitectureContent";
import { relativeTime } from "@/lib/relative-time";
import { countEvidence, type SourceLocation } from "@/lore/model";

/**
 * Real Architecture view (ADR-0008) — same fetch/render pattern as the real
 * overview page (`../page.tsx`): always reads the latest persisted run, and
 * a failed or resultless run renders honestly via `FailedRunPanel` rather
 * than as "not found."
 */
export default async function ArchitecturePage({
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
  const languages = [
    ...new Set(lore.projects.flatMap((p) => p.languages)),
  ].join(", ");
  const sourceUrl = (location: SourceLocation) =>
    githubBlobUrl(owner, repo, lore.snapshot.commitSha, location);
  const areaUrl = (location: SourceLocation) =>
    githubTreeUrl(owner, repo, lore.snapshot.commitSha, location);
  const evidenceCount = countEvidence(lore);

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel={
                lore.snapshot.status === "completed"
                  ? "Analysis current"
                  : "Analysis partial"
              }
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
        <RightRailShell title="About this architecture">
          <p className="text-sm text-muted">
            This view shows the repository&apos;s major structural areas, how
            they directly depend on one another, and its probable entry points,
            as analyzed on the default branch.
          </p>
          <p className="mt-3 text-sm text-muted">
            It reflects only what the analyzer directly detected — it does not
            infer runtime topology, infrastructure, or system-wide behavioral
            guarantees.
          </p>

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
              Evidence coverage
            </div>
            <p className="mt-1 text-2xl font-semibold text-primary">
              {evidenceCount} {evidenceCount === 1 ? "reference" : "references"}
            </p>
            <p className="mt-1 text-xs text-muted">
              These references support the areas, relationships, and entry
              points shown.
            </p>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Last verified</p>
            <p className="mt-1 text-sm text-muted">
              {relativeTime(lore.snapshot.analyzedAt)}
            </p>
          </div>
        </RightRailShell>
      }
    >
      <ArchitectureContent
        lore={lore}
        sourceUrl={sourceUrl}
        areaUrl={areaUrl}
      />
    </LorePageFrame>
  );
}
