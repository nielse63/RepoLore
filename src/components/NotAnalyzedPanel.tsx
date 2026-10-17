"use client";

import { resolveRepository, type ResolveRepositoryState } from "@/app/actions";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/Button";
import { trackEvent } from "@/lib/analytics";
import { useAnalysisStageLabel } from "@/lib/use-analysis-stage-label";
import { FolderGit2, RotateCw } from "lucide-react";
import { useActionState, useEffect } from "react";

const initialState: ResolveRepositoryState = { status: "idle" };

/**
 * `/lore/{owner}/{repo}` for a repository with no persisted run — e.g.
 * reached by swapping `github.com` for this site's host. Offers an explicit
 * "Analyze" button through the home page's own Server Action (same
 * validation, rate limits, and redirect) rather than analyzing on page
 * load, so a GET — including a crawler's — never starts analysis
 * (docs/product/non-goals.md, ADR-0017). Whether the repository exists on
 * GitHub at all is only checked on submit.
 */
export function NotAnalyzedPanel({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const [state, formAction, isPending] = useActionState(
    resolveRepository,
    initialState
  );
  const stageLabel = useAnalysisStageLabel(isPending);

  // Each action result is a new object, so a repeated error fires again.
  useEffect(() => {
    if (state.status === "error") trackEvent("submit_repo_error");
  }, [state]);

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      <SiteHeader />
      <main
        id="lore-main-content"
        className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center"
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
              <FolderGit2 className="h-7 w-7 text-muted" aria-hidden="true" />
            </div>
            <h1 className="mt-6 font-serif text-4xl font-semibold text-foreground">
              <span className="break-all font-mono text-3xl">
                {owner}/{repo}
              </span>{" "}
              hasn&apos;t been analyzed yet
            </h1>
            <p className="mt-3 max-w-md text-base text-muted">
              Build its Lore: probable entry points, major structural areas, and
              a place to start reading, each backed by evidence from the source.
              It takes a minute or two.
            </p>
            <form
              action={formAction}
              onSubmit={() => trackEvent("submit_repo")}
              className="mt-8"
            >
              <input
                type="hidden"
                name="url"
                value={`https://github.com/${owner}/${repo}`}
              />
              <Button type="submit" className="px-6 py-3">
                Analyze {owner}/{repo}
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
