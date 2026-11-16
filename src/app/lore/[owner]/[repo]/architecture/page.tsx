import { ArchitectureContent } from "@/components/lore-shell/ArchitectureContent";
import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import { redirectToStoredSpelling } from "@/lib/redirect-to-stored-spelling";
import { buildLoreMetadata, loreRouteTitle } from "@/lib/route-metadata";
import type { SourceLocation } from "@/lore/model";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  return buildLoreMetadata({
    title: loreRouteTitle(owner, repo, "Architecture"),
    description: `Major structural areas, their direct relationships, and probable entry points for ${owner}/${repo}, derived from static analysis.`,
    path: `/lore/${owner}/${repo}/architecture`,
  });
}

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
  if (!run) {
    await redirectToStoredSpelling(owner, repo, "/architecture");
    notFound();
  }

  if (run.status === "failed" || !run.result) {
    return <FailedRunPanel owner={owner} repo={repo} run={run} />;
  }

  const lore = run.result;
  const sourceUrl = (location: SourceLocation) =>
    githubBlobUrl(owner, repo, lore.snapshot.commitSha, location);
  const areaUrl = (location: SourceLocation) =>
    githubTreeUrl(owner, repo, lore.snapshot.commitSha, location);

  return (
    <LorePageFrame>
      <ArchitectureContent
        lore={lore}
        repo={repo}
        sourceUrl={sourceUrl}
        areaUrl={areaUrl}
      />
    </LorePageFrame>
  );
}
