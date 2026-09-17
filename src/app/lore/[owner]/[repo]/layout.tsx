import { scheduleBackgroundReanalysisIfStale } from "@/analysis/background-reanalysis";
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

  // Pull-triggered, staleness-gated background re-analysis (ADR-0013) — a
  // no-op unless this run is over a day old. Covers every page under this
  // layout, not just Overview, since it's already fetching `run` here.
  if (run?.status !== "failed" && run?.result) {
    scheduleBackgroundReanalysisIfStale(
      owner,
      repo,
      run.result.snapshot.analyzedAt
    );
  }

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
