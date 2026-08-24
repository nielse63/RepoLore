'use client';

import { Button } from '@/components/ui/Button';
import { FolderGit2 } from 'lucide-react';
import { useActionState } from 'react';
import { resolveRepository, type ResolveRepositoryState } from './actions';

const initialState: ResolveRepositoryState = { status: 'idle' };

/**
 * Landing page: paste a public GitHub repository URL, analyze and persist
 * it, and land on its stable `/lore/{owner}/{repo}` page (MVP core user
 * journey, docs/product/mvp.md). On success the Server Action redirects
 * there directly, so this page only ever needs to show an error for
 * failures that happen before a run exists to redirect to. Reflects the
 * hero from docs/designs/home.png; the marketing imagery below the fold is
 * deferred.
 */
export default function Home() {
  const [state, formAction, isPending] = useActionState(
    resolveRepository,
    initialState
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border px-8 py-5">
        <span className="font-serif text-xl font-semibold text-foreground">
          Repo Lore
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-24 pb-16 text-center">
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
            {isPending ? 'Analyzing…' : 'Analyze repository'}
          </Button>
        </form>

        {state.status === 'error' && (
          <p role="alert" className="mt-4 text-sm text-tile-alert-fg">
            <strong>Error:</strong> {state.message}
          </p>
        )}
      </main>
    </div>
  );
}
