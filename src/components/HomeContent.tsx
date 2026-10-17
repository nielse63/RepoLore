"use client";

import { resolveRepository, type ResolveRepositoryState } from "@/app/actions";
import { LoreCard } from "@/components/LoreCard";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/Button";
import type { LatestRunIndexabilityRow } from "@/db/analysis-runs";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { useAnalysisStageLabel } from "@/lib/use-analysis-stage-label";
import { FolderGit2, RotateCw } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect } from "react";

const initialState: ResolveRepositoryState = { status: "idle" };

/**
 * Landing page content: paste a public GitHub repository URL, analyze and
 * persist it, and land on its stable `/lore/{owner}/{repo}` page (the core
 * user journey — see docs/product/mission.md). On success the Server
 * Action redirects there directly, so this page only ever needs to show
 * an error for failures that happen before a run exists to redirect to.
 * Below the form, `featuredLores` (chosen server-side by
 * `selectFeaturedLores`) link to example Lores and `/explore`, so visitors
 * can see a real Lore before submitting and crawlers reach indexable Lores
 * from the home page; the section is omitted when there are none.
 *
 * A separate client component from `src/app/page.tsx` so the route file can
 * stay a Server Component and export its own route-specific metadata
 * (canonical, Open Graph, Twitter) rather than inheriting the root layout's.
 */
export function HomeContent({
  featuredLores,
}: {
  featuredLores: LatestRunIndexabilityRow[];
}) {
  const [state, formAction, isPending] = useActionState(
    resolveRepository,
    initialState
  );
  const stageLabel = useAnalysisStageLabel(isPending);

  // A submission rejected before any run exists.
  // Each action result is a new object, so a repeated error fires again.
  useEffect(() => {
    if (state.status === "error") trackEvent("submit_repo_error");
  }, [state]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <SiteHeader />

      <main
        className={cn(
          "flex flex-1 flex-col items-center px-6 text-center",
          isPending ? "justify-center" : "pt-24 pb-16"
        )}
      >
        {isPending ? (
          <div className="flex flex-col items-center gap-6" role="status">
            <RotateCw
              className="h-10 w-10 animate-spin text-primary"
              aria-hidden="true"
            />
            <p
              className="text-lg font-medium text-foreground"
              aria-live="polite"
            >
              {stageLabel}
            </p>
          </div>
        ) : (
          <>
            <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-tight text-foreground sm:text-6xl">
              Understand any codebase with confidence.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Repo Lore builds a living, evidence-backed mental model of your
              software.
            </p>

            <form
              action={formAction}
              onSubmit={() => trackEvent("submit_repo")}
              className="mt-10 flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
            >
              <div className="relative flex-1">
                <FolderGit2
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <label htmlFor="url" className="sr-only">
                  GitHub repository URL
                </label>
                <input
                  id="url"
                  name="url"
                  type="text"
                  placeholder="https://github.com/owner/repository"
                  className="w-full rounded-lg border border-border bg-surface py-3 pl-12 pr-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={isPending} className="px-6 py-3">
                Analyze repository
              </Button>
            </form>

            {state.status === "error" && (
              <p role="alert" className="mt-4 text-sm text-tile-alert-fg">
                <strong>Error:</strong> {state.message}
              </p>
            )}

            {featuredLores.length > 0 && (
              <section
                aria-labelledby="example-lores-heading"
                className="mt-20 w-full max-w-5xl"
              >
                <h2
                  id="example-lores-heading"
                  className="font-serif text-2xl font-semibold text-foreground"
                >
                  See an example Lore
                </h2>
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featuredLores.map((lore) => (
                    <LoreCard key={`${lore.owner}/${lore.repo}`} lore={lore} />
                  ))}
                </ul>
                <Link
                  href="/explore"
                  className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Browse all Lores →
                </Link>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
