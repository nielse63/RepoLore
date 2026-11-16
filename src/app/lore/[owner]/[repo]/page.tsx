import { NotAnalyzedPanel } from "@/components/NotAnalyzedPanel";
import { SubmissionOutcomeEvent } from "@/components/SubmissionOutcomeEvent";
import { FailedRunPanel } from "@/components/lore-shell/FailedRunPanel";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { OverviewContent } from "@/components/lore-shell/OverviewContent";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import {
  indexabilityFactsFromRun,
  isIndexableLore,
} from "@/lib/lore-indexability";
import { redirectToStoredSpelling } from "@/lib/redirect-to-stored-spelling";
import {
  buildLoreMetadata,
  loreOverviewDescription,
  loreOverviewTitle,
} from "@/lib/route-metadata";
import type { SourceLocation } from "@/lore/model";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { owner, repo } = await params;
  const run = await getLatestAnalysisRunForRepo(owner, repo);
  // A failed run can still carry a result, but the page renders the failure
  // (`FailedRunPanel`), so its metadata mustn't describe that content.
  const lore = run && run.status !== "failed" ? run.result : null;
  return buildLoreMetadata({
    title: loreOverviewTitle(owner, repo, lore),
    description: loreOverviewDescription(owner, repo, lore),
    path: `/lore/${owner}/${repo}`,
    indexable: isIndexableLore(indexabilityFactsFromRun(run)),
  });
}

/**
 * Renders the latest persisted analysis run for a repository (acceptance
 * criterion 10). Not a static/cached page — always reads the current
 * latest run, so a re-analysis (session 11) is visible on next load without
 * a redeploy. A `'failed'` run is rendered honestly, with its error, rather
 * than presented as "not found." A repository with no run at all gets an
 * explicit "Analyze" button (`NotAnalyzedPanel`, `noindex` like any
 * non-indexable Lore) instead of a 404, so a swapped `github.com` URL
 * (`src/app/[...path]/page.tsx`) never dead-ends.
 */
export default async function LorePage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; repo: string }>;
  searchParams: Promise<{
    submitted?: string | string[];
    page?: string | string[];
  }>;
}) {
  const [{ owner, repo }, { submitted, page }] = await Promise.all([
    params,
    searchParams,
  ]);
  const run = await getLatestAnalysisRunForRepo(owner, repo);
  if (!run) {
    await redirectToStoredSpelling(owner, repo);
    return <NotAnalyzedPanel owner={owner} repo={repo} />;
  }

  // Set by the home page's Server Action redirect, whose run is this latest one.
  const outcomeEvent = submitted ? (
    <SubmissionOutcomeEvent status={run.status} />
  ) : null;

  if (run.status === "failed" || !run.result) {
    return (
      <>
        {outcomeEvent}
        <FailedRunPanel owner={owner} repo={repo} run={run} />
      </>
    );
  }

  const lore = run.result;
  const sourceUrl = (location: SourceLocation) =>
    githubBlobUrl(owner, repo, lore.snapshot.commitSha, location);
  const areaUrl = (location: SourceLocation) =>
    githubTreeUrl(owner, repo, lore.snapshot.commitSha, location);

  return (
    <>
      {outcomeEvent}
      <LorePageFrame>
        <OverviewContent
          lore={lore}
          sourceUrl={sourceUrl}
          areaUrl={areaUrl}
          majorAreasPage={page}
        />
      </LorePageFrame>
    </>
  );
}
