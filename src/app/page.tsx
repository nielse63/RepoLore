'use client';

import { useActionState } from 'react';
import { resolveRepository, type ResolveRepositoryState } from './actions';

const initialState: ResolveRepositoryState = { status: 'idle' };

/**
 * Plain, unstyled home page: paste a public GitHub repository URL, analyze
 * and persist it, and land on its stable `/lore/{owner}/{repo}` page (MVP
 * core user journey, docs/product/mvp.md). On success the Server Action
 * redirects there directly, so this page only ever needs to show an error
 * for failures that happen before a run exists to redirect to.
 */
export default function Home() {
  const [state, formAction, isPending] = useActionState(
    resolveRepository,
    initialState
  );

  return (
    <main>
      <h1>Repo Lore</h1>
      <p>Paste a public GitHub repository URL to get started.</p>

      <form action={formAction}>
        <label htmlFor="url">GitHub repository URL</label>
        <br />
        <input
          id="url"
          name="url"
          type="text"
          placeholder="https://github.com/owner/repo"
          size={50}
        />{' '}
        <button type="submit" disabled={isPending}>
          {isPending ? 'Analyzing…' : 'Analyze'}
        </button>
      </form>

      {state.status === 'error' && (
        <p role="alert">
          <strong>Error:</strong> {state.message}
        </p>
      )}
    </main>
  );
}
