/**
 * Minimal GitHub REST API client covering what the MVP core user journey
 * needs so far (docs/product/mvp.md, steps 2–5): resolve a repository's
 * default branch and HEAD commit SHA, and fetch the source tarball at a
 * given ref (ADR-0002). This is the first code path that calls the GitHub
 * API, so it's also the first to require a PAT (ADR-0002's consequence:
 * unauthenticated access is capped at 60 requests/hour).
 */

const API_BASE = "https://api.github.com";

export type GitHubApiErrorCode =
  "missing-token" | "not-found" | "unauthorized" | "rate-limited" | "unknown";

export class GitHubApiError extends Error {
  code: GitHubApiErrorCode;

  constructor(code: GitHubApiErrorCode, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.code = code;
  }
}

function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new GitHubApiError(
      "missing-token",
      "No GITHUB_TOKEN is configured. Set GITHUB_TOKEN in .env.local (see .env.example)."
    );
  }
  return token;
}

export async function githubApiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getGitHubToken();
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "repo-lore",
      ...init.headers,
    },
  });
}

export async function throwForResponse(
  res: Response,
  notFoundContext: string
): Promise<never> {
  if (res.status === 404) {
    throw new GitHubApiError(
      "not-found",
      `${notFoundContext} — it may not exist, or it may be private.`
    );
  }
  if (res.status === 401) {
    throw new GitHubApiError(
      "unauthorized",
      "GitHub rejected the configured GITHUB_TOKEN as invalid or expired."
    );
  }
  if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
    throw new GitHubApiError(
      "rate-limited",
      "GitHub API rate limit exceeded. Try again after the limit resets."
    );
  }
  const body = await res.text().catch(() => "");
  throw new GitHubApiError(
    "unknown",
    `GitHub API request failed (${res.status} ${res.statusText}).${body ? ` ${body}` : ""}`
  );
}

export interface RepositoryHead {
  defaultBranch: string;
  headSha: string;
  /** GitHub's own repository description, when set — surfaced as-is, not inferred. */
  description?: string;
}

/**
 * Resolves a repository's default branch and the current HEAD commit SHA on
 * that branch (MVP core user journey steps 3–5: resolve default branch,
 * analyze its latest commit, record the exact SHA).
 */
export async function resolveRepositoryHead(
  owner: string,
  repo: string
): Promise<RepositoryHead> {
  const repoRes = await githubApiFetch(`/repos/${owner}/${repo}`);
  if (!repoRes.ok) {
    await throwForResponse(repoRes, `Repository ${owner}/${repo} not found`);
  }
  const repoData = (await repoRes.json()) as {
    default_branch?: string;
    description?: string | null;
  };
  const defaultBranch = repoData.default_branch;
  if (!defaultBranch) {
    throw new GitHubApiError(
      "unknown",
      `GitHub did not report a default branch for ${owner}/${repo}.`
    );
  }

  const commitRes = await githubApiFetch(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(defaultBranch)}`
  );
  if (!commitRes.ok) {
    await throwForResponse(
      commitRes,
      `Default branch ${defaultBranch} on ${owner}/${repo} not found`
    );
  }
  const commitData = (await commitRes.json()) as { sha?: string };
  if (!commitData.sha) {
    throw new GitHubApiError(
      "unknown",
      `GitHub did not report a HEAD commit SHA for ${owner}/${repo}@${defaultBranch}.`
    );
  }

  return {
    defaultBranch,
    headSha: commitData.sha,
    description: repoData.description ?? undefined,
  };
}

/**
 * Fetches a repository's byte-weighted per-language breakdown (ADR-0007) —
 * the same data GitHub's own repository page computes its language
 * percentage bar from. Keys are GitHub's linguist language names (e.g.
 * "Python", "JavaScript"); values are bytes of code classified as that
 * language at the repository's default branch. An empty repository (or one
 * GitHub hasn't classified any files in) returns `{}`, not an error.
 */
export async function fetchRepositoryLanguages(
  owner: string,
  repo: string
): Promise<Record<string, number>> {
  const res = await githubApiFetch(`/repos/${owner}/${repo}/languages`);
  if (!res.ok) {
    await throwForResponse(res, `Languages for ${owner}/${repo} not found`);
  }
  return (await res.json()) as Record<string, number>;
}

/**
 * Fetches a repository's source tarball at `ref` (ADR-0002). Returns the
 * raw `Response` so the caller can stream `.body` straight to disk rather
 * than buffering the whole archive in memory. GitHub redirects this
 * endpoint to codeload.github.com, which `fetch` follows automatically and
 * which serves public-repo archives unauthenticated, so the redirect
 * working without carrying the `Authorization` header over is expected.
 */
export async function fetchRepositoryTarball(
  owner: string,
  repo: string,
  ref: string,
  signal?: AbortSignal
): Promise<Response> {
  const res = await githubApiFetch(
    `/repos/${owner}/${repo}/tarball/${encodeURIComponent(ref)}`,
    { signal }
  );
  if (!res.ok) {
    await throwForResponse(
      res,
      `Tarball for ${owner}/${repo}@${ref} not found`
    );
  }
  return res;
}
