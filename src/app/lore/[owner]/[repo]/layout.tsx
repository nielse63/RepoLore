import { Sidebar } from '@/components/lore-shell/Sidebar';

export default async function LoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar owner={owner} repo={repo} />
      {children}
    </div>
  );
}
