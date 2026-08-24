import { Sidebar } from '@/components/lore-shell/Sidebar';
import { getLatestAnalysisRunForRepo } from '@/db/analysis-runs';

export default async function LoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const run = await getLatestAnalysisRunForRepo(owner, repo);
  const visibility = run?.result?.snapshot.repository.isPrivate
    ? 'Private'
    : 'Public';
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar owner={owner} repo={repo} visibility={visibility} />
      {children}
    </div>
  );
}
