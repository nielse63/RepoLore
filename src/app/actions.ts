'use server';

import { redirect } from 'next/navigation';
import { analyzeAndPersistRepository } from '@/analysis/analyze-and-persist';
import { GitHubApiError } from '@/github/client';
import { parseGitHubRepoUrl } from '@/github/parse-repo-url';

export type ResolveRepositoryState =
  { status: 'idle' } | { status: 'error'; message: string };

/**
 * Server Action backing the home page's URL form: validates/normalizes the
 * pasted URL, analyzes and persists the repository (MVP core user journey
 * steps 1–6), and redirects to the stable `/lore/{owner}/{repo}` page. A
 * failed/partial analysis still redirects — it has a persisted run to render
 * honestly; only pre-analysis failures (bad URL, repo doesn't exist) stay on
 * this page as an inline error, since there's no run to redirect to yet.
 */
export async function resolveRepository(
  _prevState: ResolveRepositoryState,
  formData: FormData
): Promise<ResolveRepositoryState> {
  const rawUrl = formData.get('url');
  const parsed = parseGitHubRepoUrl(typeof rawUrl === 'string' ? rawUrl : '');
  if (!parsed.ok) {
    return { status: 'error', message: parsed.reason };
  }

  const { owner, repo } = parsed.value;
  try {
    await analyzeAndPersistRepository(owner, repo);
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { status: 'error', message: error.message };
    }
    return {
      status: 'error',
      message: 'Something went wrong analyzing that repository.',
    };
  }

  redirect(`/lore/${owner}/${repo}`);
}
