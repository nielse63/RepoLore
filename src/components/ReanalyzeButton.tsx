'use client';

import { useActionState } from 'react';
import { reanalyzeRepository, type ReanalyzeState } from '@/app/actions';

const initialState: ReanalyzeState = { status: 'idle' };

/**
 * "Re-analyze" button for `/lore/{owner}/{repo}` (session 11, acceptance
 * criterion 11). Plain, unstyled, matching the rest of the app. Not used on
 * `/fixtures/{name}` — those have no real repository to re-analyze.
 */
export function ReanalyzeButton({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const reanalyzeWithParams = reanalyzeRepository.bind(null, owner, repo);
  const [state, formAction, isPending] = useActionState(
    reanalyzeWithParams,
    initialState
  );

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Re-analyzing…' : 'Re-analyze'}
      </button>
      {state.status === 'done' && (
        <p>
          {state.changed
            ? 'Re-analyzed — a new commit was found and analyzed.'
            : 'Already up to date — no new commit since the last analysis.'}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert">
          <strong>Error:</strong> {state.message}
        </p>
      )}
    </form>
  );
}
