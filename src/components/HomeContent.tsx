"use client";

import { resolveRepository, type ResolveRepositoryState } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import {
  getDelayAfterStage,
  getStageLabel,
} from "@/lib/analysis-loading-stages";
import { cn } from "@/lib/cn";
import { FolderGit2, RotateCw } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

const initialState: ResolveRepositoryState = { status: "idle" };

/**
 * Landing page content: paste a public GitHub repository URL, analyze and
 * persist it, and land on its stable `/lore/{owner}/{repo}` page (MVP core
 * user journey, docs/product/mvp.md). On success the Server Action redirects
 * there directly, so this page only ever needs to show an error for
 * failures that happen before a run exists to redirect to. Reflects the
 * hero from docs/designs/home.png; the marketing imagery below the fold is
 * deferred.
 *
 * A separate client component from `src/app/page.tsx` so the route file can
 * stay a Server Component and export its own route-specific metadata
 * (canonical, Open Graph, Twitter) rather than inheriting the root layout's.
 */
export function HomeContent() {
  const [state, formAction, isPending] = useActionState(
    resolveRepository,
    initialState
  );
  const [stageIndex, setStageIndex] = useState(0);
  // Resets the stage index whenever a submission starts or finishes, so the
  // next submission narrates from the beginning again. Set during render
  // (React's documented pattern for state that tracks a prop/derived value)
  // rather than in the effect below, which only owns the interval subscription.
  const [prevIsPending, setPrevIsPending] = useState(isPending);
  if (isPending !== prevIsPending) {
    setPrevIsPending(isPending);
    setStageIndex(0);
  }

  // Re-schedules on every stageIndex change (rather than a single interval)
  // because the delay isn't constant: it's STAGE_INTERVAL_MS while narrating
  // real phases, then a randomized 30-45s once into REASSURANCE_STAGES.
  useEffect(() => {
    if (!isPending) return;
    const timeoutId = setTimeout(() => {
      setStageIndex((i) => i + 1);
    }, getDelayAfterStage(stageIndex));
    return () => clearTimeout(timeoutId);
  }, [isPending, stageIndex]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border px-8 py-5">
        <span className="font-serif text-xl font-semibold text-foreground">
          Repo Lore
        </span>
      </header>

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
              {getStageLabel(stageIndex)}
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
          </>
        )}
      </main>
    </div>
  );
}
