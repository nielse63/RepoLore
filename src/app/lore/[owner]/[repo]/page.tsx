import { notFound } from 'next/navigation';
import { getLatestAnalysisRunForRepo } from '@/db/analysis-runs';
import { githubBlobUrl, githubTreeUrl } from '@/github/urls';
import { LoreView } from '@/components/LoreView';
import { ReanalyzeButton } from '@/components/ReanalyzeButton';

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

  if (run.status === 'failed' || !run.result) {
    return (
      <main>
        <h1>
          {owner}/{repo}
        </h1>
        <p>
          Analysis failed for commit <code>{run.commitSha}</code> (analyzer{' '}
          {run.analyzerVersion}, {new Date(run.createdAt).toLocaleString()}).
        </p>
        <p role="alert">{run.errorMessage ?? 'Unknown error.'}</p>
        <ReanalyzeButton owner={owner} repo={repo} />
      </main>
    );
  }

  const lore = run.result;
  return (
    <LoreView
      lore={lore}
      sourceUrl={(location) =>
        githubBlobUrl(owner, repo, lore.snapshot.commitSha, location)
      }
      areaUrl={(location) =>
        githubTreeUrl(owner, repo, lore.snapshot.commitSha, location)
      }
      actions={<ReanalyzeButton owner={owner} repo={repo} />}
    />
  );
}
