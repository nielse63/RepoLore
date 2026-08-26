import { DataFlowContent } from "@/components/lore-shell/DataFlowContent";
import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { getAnalysisStatus } from "@/helpers";
import { relativeTime } from "@/lib/relative-time";
import { buildLoreMetadata, loreRouteTitle } from "@/lib/route-metadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  return buildLoreMetadata({
    title: loreRouteTitle(owner, repo, "Data Flow"),
    description: `Statically resolved calls between named functions and methods in ${owner}/${repo} — which function mechanically calls which.`,
    path: `/lore/${owner}/${repo}/data-flow`,
  });
}

/**
 * Real Data Flow view (ADR-0012) — same fetch/render pattern as the real
 * Overview/Architecture/Dependencies pages: always reads the latest
 * persisted analysis run, and a failed or resultless run renders honestly
 * via `FailedRunPanel` rather than as "not found." The route stays
 * `/data-flow` for reversibility even though the page itself now renders a
 * function-level call graph rather than the system-journey mockup this URL
 * originally matched — see ADR-0012.
 */
export default async function DataFlowPage({
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

  return (
    <DataFlowContent
      owner={owner}
      repo={repo}
      lore={lore}
      repoIdentity={{
        statusLabel: getAnalysisStatus(lore),
        statusTone: lore.snapshot.status === "completed" ? "success" : "alert",
        updatedLabel: `Analyzed ${relativeTime(lore.snapshot.analyzedAt)}`,
        branch: lore.snapshot.repository.defaultBranch,
        language: languages,
      }}
    />
  );
}
