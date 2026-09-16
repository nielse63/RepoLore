import { Sidebar } from "@/components/lore-shell/Sidebar";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";

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
    ? "Private"
    : "Public";
  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#lore-main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar owner={owner} repo={repo} visibility={visibility} />
      {children}
    </div>
  );
}
