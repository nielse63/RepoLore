/**
 * Commit-list and commit-diff GitHub REST API calls, added for the History
 * page (docs/architecture/decisions/0010-history-page-real-data-scope.md).
 * This is new API surface beyond `client.ts`'s original scope (default
 * branch/HEAD resolution and tarball fetch) — bounded deliberately: a fixed
 * lookback window and a hard cap on commits processed per compute, so a
 * high-activity repository can't silently burn through the shared token's
 * rate limit or make a page load unbounded.
 */

import { githubApiFetch, throwForResponse } from "./client";

/** How far back History looks for commits, from "now" at compute time. */
export const HISTORY_LOOKBACK_DAYS = 90;

/** Hard cap on commits fetched/classified per compute — truncation is surfaced, never silent. */
export const MAX_COMMITS_PER_COMPUTE = 200;

const COMMITS_PER_PAGE = 100;

export interface CommitSummary {
  sha: string;
  message: string;
  authorName: string;
  authorLogin?: string;
  authoredAt: string;
}

export interface ListCommitsResult {
  commits: CommitSummary[];
  /** True when more commits exist in the window than `MAX_COMMITS_PER_COMPUTE` allowed fetching. */
  truncated: boolean;
}

interface GitHubCommitListItem {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
  author: { login: string } | null;
}

/**
 * Lists commits on `branch` since `since`, newest first, paginating until
 * either the branch is exhausted or `MAX_COMMITS_PER_COMPUTE` is reached.
 */
export async function listCommitsSince(
  owner: string,
  repo: string,
  { branch, since }: { branch: string; since: Date }
): Promise<ListCommitsResult> {
  const commits: CommitSummary[] = [];
  let page = 1;
  let truncated = false;

  for (;;) {
    const params = new URLSearchParams({
      sha: branch,
      since: since.toISOString(),
      per_page: String(COMMITS_PER_PAGE),
      page: String(page),
    });
    const res = await githubApiFetch(
      `/repos/${owner}/${repo}/commits?${params.toString()}`
    );
    if (!res.ok) {
      await throwForResponse(
        res,
        `Commits for ${owner}/${repo}@${branch} not found`
      );
    }
    const items = (await res.json()) as GitHubCommitListItem[];
    if (items.length === 0) break;

    for (const item of items) {
      if (commits.length >= MAX_COMMITS_PER_COMPUTE) {
        truncated = true;
        break;
      }
      commits.push({
        sha: item.sha,
        message: item.commit.message,
        authorName: item.commit.author?.name ?? "Unknown",
        authorLogin: item.author?.login,
        authoredAt: item.commit.author?.date ?? new Date(0).toISOString(),
      });
    }

    if (truncated || items.length < COMMITS_PER_PAGE) break;
    page += 1;
  }

  return { commits, truncated };
}

export interface CommitFileChange {
  filePath: string;
  status: string;
  additions: number;
  deletions: number;
  /** Undefined when GitHub omits the patch for a very large diff — treated as an honest gap, not an error. */
  patch?: string;
}

export interface CommitDetail {
  sha: string;
  files: CommitFileChange[];
}

interface GitHubCommitDetail {
  sha: string;
  files?: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }[];
}

/** Fetches the changed files (with patch text, where GitHub provides one) for a single commit. */
export async function fetchCommitDetail(
  owner: string,
  repo: string,
  sha: string
): Promise<CommitDetail> {
  const res = await githubApiFetch(`/repos/${owner}/${repo}/commits/${sha}`);
  if (!res.ok) {
    await throwForResponse(res, `Commit ${sha} on ${owner}/${repo} not found`);
  }
  const data = (await res.json()) as GitHubCommitDetail;
  return {
    sha: data.sha,
    files: (data.files ?? []).map((f) => ({
      filePath: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    })),
  };
}
