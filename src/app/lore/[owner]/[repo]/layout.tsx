import { scheduleBackgroundReanalysisIfStale } from "@/analysis/background-reanalysis";
import type { ShellAnalysis } from "@/components/lore-shell/AnalysisDialog";
import { LoreShellProvider } from "@/components/lore-shell/LoreShellContext";
import { MobileNavProvider } from "@/components/lore-shell/MobileNavContext";
import { Sidebar } from "@/components/lore-shell/Sidebar";
import { TopBar } from "@/components/lore-shell/TopBar";
import {
  getLatestAnalysisRunForRepo,
  type AnalysisRunRow,
} from "@/db/analysis-runs";
import { isCrawlerUserAgent } from "@/lib/is-crawler-user-agent";
import {
  badgeImageUrl,
  loreUrl,
  readmeBadgeSnippets,
} from "@/lib/readme-badge";
import { siteMetadataBase } from "@/lib/route-metadata";
import { analysisSources } from "@/lore/analysis-sources";
import { headers } from "next/headers";

/**
 * What the shell's status line and Analysis dialog show for the latest run.
 * A failed or resultless run is presented as failed, matching the pages'
 * `FailedRunPanel`.
 */
function shellAnalysis(run: AnalysisRunRow): ShellAnalysis {
  const lore = run.result;
  if (run.status === "failed" || !lore) {
    return {
      status: "failed",
      commitSha: run.commitSha,
      branch: lore?.snapshot.repository.defaultBranch,
      analyzedAt: run.createdAt,
      analyzerVersion: run.analyzerVersion,
      gaps: [],
      errorMessage: run.errorMessage ?? undefined,
    };
  }
  return {
    status: lore.snapshot.status,
    commitSha: lore.snapshot.commitSha,
    branch: lore.snapshot.repository.defaultBranch,
    analyzedAt: lore.snapshot.analyzedAt,
    analyzerVersion: lore.snapshot.analyzerVersion,
    sources: analysisSources(lore),
    gaps: lore.gaps,
  };
}

export default async function LoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const run = await getLatestAnalysisRunForRepo(owner, repo);

  // Pull-triggered, staleness-gated background re-analysis (ADR-0013) — a
  // no-op unless this run is over a day old. Covers every page under this
  // layout, not just Overview, since it's already fetching `run` here.
  // Skipped for crawlers: now that Overview pages can be indexed, a crawler
  // fetch would otherwise be a visitor-less refresh (ADR-0017, docs/product/non-goals.md).
  const userAgent = (await headers()).get("user-agent");
  if (
    run?.status !== "failed" &&
    run?.result &&
    !isCrawlerUserAgent(userAgent)
  ) {
    scheduleBackgroundReanalysisIfStale(
      owner,
      repo,
      run.result.snapshot.analyzedAt
    );
  }

  // No run yet: the Overview renders a full-page "Analyze" prompt and every
  // subview 404s, so there's no Lore for the shell to frame.
  if (!run) return children;

  const site = siteMetadataBase();

  return (
    <MobileNavProvider>
      <LoreShellProvider
        owner={owner}
        repo={repo}
        analysis={shellAnalysis(run)}
        loreUrl={loreUrl(owner, repo, site)}
        badgeImageUrl={badgeImageUrl(site)}
        badgeSnippets={readmeBadgeSnippets(owner, repo, site)}
      >
        <div className="flex min-h-dvh flex-col bg-background">
          <a
            href="#lore-main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <TopBar owner={owner} repo={repo} />
          <div className="flex min-w-0 flex-1">
            <Sidebar owner={owner} repo={repo} />
            {children}
          </div>
        </div>
      </LoreShellProvider>
    </MobileNavProvider>
  );
}
