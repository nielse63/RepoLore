'use server';

import { GitHubApiError, resolveRepositoryHead } from '@/github/client';
import { parseGitHubRepoUrl } from '@/github/parse-repo-url';

export type ResolveRepositoryState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | {
      status: 'success';
      owner: string;
      repo: string;
      defaultBranch: string;
      headSha: string;
    };

/**
 * Server Action backing the home page's URL form: validates/normalizes the
 * pasted URL, then resolves the repository's default branch and HEAD commit
 * SHA (MVP core user journey steps 1–5). Analysis, acquisition, and
 * persistence are later sessions — this proves the input-to-GitHub-API path
 * end to end with an honest error for every failure mode.
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
    const { defaultBranch, headSha } = await resolveRepositoryHead(owner, repo);
    return { status: 'success', owner, repo, defaultBranch, headSha };
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return { status: 'error', message: error.message };
    }
    return {
      status: 'error',
      message: 'Something went wrong resolving that repository.',
    };
  }
}
