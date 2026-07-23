import { notFound } from 'next/navigation';
import { getLatestAnalysisRunForRepo } from '@/db/analysis-runs';
import { githubBlobUrl, githubTreeUrl } from '@/github/urls';
import { ReanalyzeButton } from '@/components/ReanalyzeButton';
import { TopBar } from '@/components/lore-shell/TopBar';
import { RepoIdentity } from '@/components/lore-shell/RepoIdentity';
import { LorePageFrame } from '@/components/lore-shell/LorePageFrame';
import { OverviewContent } from '@/components/lore-shell/OverviewContent';
import { AnalysisRail } from '@/components/lore-shell/AnalysisRail';
import { Card } from '@/components/ui/Card';
import { relativeTime } from '@/lib/relative-time';
import type { SourceLocation } from '@/lore/model';

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
            Analysis failed for commit{' '}
            <code className="font-mono">{run.commitSha}</code> (analyzer{' '}
            {run.analyzerVersion}, {new Date(run.createdAt).toLocaleString()}).
          </p>
          <Card
            className="mt-4 border-tile-alert-fg/30 bg-tile-alert-bg"
            role="alert"
          >
            <p className="text-sm text-tile-alert-fg">
              {run.errorMessage ?? 'Unknown error.'}
            </p>
          </Card>
        </div>
      </LorePageFrame>
    );
  }

  const lore = run.result;
  const project = lore.projects[0];
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
              statusLabel={
                lore.snapshot.status === 'completed'
                  ? 'Analysis current'
                  : 'Analysis partial'
              }
              statusTone={
                lore.snapshot.status === 'completed' ? 'success' : 'alert'
              }
              updatedLabel={`Analyzed ${relativeTime(lore.snapshot.analyzedAt)}`}
              branch={lore.snapshot.repository.defaultBranch}
              language={project?.languages.join(', ')}
            />
          }
          actions={<ReanalyzeButton owner={owner} repo={repo} />}
        />
      }
      rightRail={<AnalysisRail snapshot={lore.snapshot} gaps={lore.gaps} />}
    >
      <OverviewContent lore={lore} sourceUrl={sourceUrl} areaUrl={areaUrl} />
    </LorePageFrame>
  );
}
