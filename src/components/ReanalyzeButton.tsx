'use client';

import { useActionState } from 'react';
import { RotateCw } from 'lucide-react';
import { reanalyzeRepository, type ReanalyzeState } from '@/app/actions';
import { Button } from '@/components/ui/Button';

const initialState: ReanalyzeState = { status: 'idle' };

/**
 * "Re-analyze" button for `/lore/{owner}/{repo}` (session 11, acceptance
 * criterion 11). Not used on `/fixtures/{name}` — those have no real
 * repository to re-analyze.
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
    <form action={formAction} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="secondary" disabled={isPending}>
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        {isPending ? 'Re-analyzing…' : 'Re-analyze'}
      </Button>
      {state.status === 'done' && (
        <p className="text-xs text-muted">
          {state.changed
            ? 'Re-analyzed — a new commit was found and analyzed.'
            : 'Already up to date — no new commit since the last analysis.'}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="text-xs text-tile-alert-fg">
          <strong>Error:</strong> {state.message}
        </p>
      )}
    </form>
  );
}
