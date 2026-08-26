import { DependenciesContent } from "@/components/lore-shell/DependenciesContent";
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
    title: loreRouteTitle(owner, repo, "Dependencies"),
    description: `External and internal dependencies for ${owner}/${repo}, with usage evidence for where each one is referenced in the analyzed source.`,
    path: `/lore/${owner}/${repo}/dependencies`,
  });
}

/**
 * Real Dependencies view (ADR-0011) — same fetch/render pattern as the real
 * Overview/Architecture/History pages: always reads the latest persisted
 * analysis run, and a failed or resultless run renders honestly via
 * `FailedRunPanel` rather than as "not found."
 */
export default async function DependenciesPage({
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
    <DependenciesContent
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
