'use client';

import { useActionState } from 'react';
import { resolveRepository, type ResolveRepositoryState } from './actions';

const initialState: ResolveRepositoryState = { status: 'idle' };

/**
 * Plain, unstyled home page: paste a public GitHub repository URL and
 * resolve its default branch + HEAD commit SHA (MVP core user journey steps
 * 1–5, docs/product/mvp.md). Acquisition, analysis, and the persisted
 * `/lore/{owner}/{repo}` page are later sessions — this proves the
 * input-validation-to-GitHub-API path end to end first.
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
          {isPending ? 'Resolving…' : 'Resolve'}
        </button>
      </form>

      {state.status === 'error' && (
        <p role="alert">
          <strong>Error:</strong> {state.message}
        </p>
      )}

      {state.status === 'success' && (
        <section>
          <h2>Resolved</h2>
          <ul>
            <li>
              Repository: {state.owner}/{state.repo}
            </li>
            <li>Default branch: {state.defaultBranch}</li>
            <li>
              HEAD commit: <code>{state.headSha}</code>
            </li>
          </ul>
        </section>
      )}
    </main>
  );
}
