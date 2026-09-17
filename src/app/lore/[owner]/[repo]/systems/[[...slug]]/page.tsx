import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { SystemDetailContent } from "@/components/lore-shell/SystemDetailContent";
import { SystemsContent } from "@/components/lore-shell/SystemsContent";
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
    title: loreRouteTitle(owner, repo, "Systems"),
    description: `The responsibilities, boundaries, and relationships that make up ${owner}/${repo}, derived from its Major Areas.`,
    path: `/lore/${owner}/${repo}/systems`,
  });
}

/**
 * Real Systems view (ADR-0014) — same fetch/render pattern as the real
 * Overview/Architecture/Dependencies pages: always reads the latest
 * persisted analysis run, and a failed or resultless run renders honestly
 * via `FailedRunPanel` rather than as "not found." An optional catch-all: no
 * slug segment renders the list view; one segment renders the subview for
 * that area's slug; more than one segment (no mockup-backed nested route
 * exists) is not found.
 */
export default async function SystemsPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string; slug?: string[] }>;
}) {
  const { owner, repo, slug } = await params;
  if (slug && slug.length > 1) notFound();

  const run = await getLatestAnalysisRunForRepo(owner, repo);
  if (!run) notFound();

  if (run.status === "failed" || !run.result) {
    return <FailedRunPanel owner={owner} repo={repo} run={run} />;
  }

  const lore = run.result;

  if (slug?.[0]) {
    return (
      <SystemDetailContent
        owner={owner}
        repo={repo}
        lore={lore}
        areaSlug={slug[0]}
      />
    );
  }

  const languages = [
    ...new Set(lore.projects.flatMap((p) => p.languages)),
  ].join(", ");

  return (
    <SystemsContent
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
