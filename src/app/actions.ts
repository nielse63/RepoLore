"use server";

import { analyzeAndPersistRepository } from "@/analysis/analyze-and-persist";
import { RateLimitedError } from "@/analysis/reanalysis-rate-limit";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { GitHubApiError } from "@/github/client";
import { parseGitHubRepoUrl } from "@/github/parse-repo-url";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type ResolveRepositoryState =
  { status: "idle" } | { status: "error"; message: string };

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
  const rawUrl = formData.get("url");
  const rawUrlString = typeof rawUrl === "string" ? rawUrl : "";
  if (!rawUrlString.includes("github.com")) {
    return {
      status: "error",
      message: "A GitHub URL is required",
    };
  }
  const parsed = parseGitHubRepoUrl(rawUrlString);
  if (!parsed.ok) {
    return { status: "error", message: parsed.reason };
  }

  const { owner, repo } = parsed.value;
  try {
    await analyzeAndPersistRepository(owner, repo);
  } catch (error) {
    if (error instanceof GitHubApiError || error instanceof RateLimitedError) {
      return { status: "error", message: error.message };
    }
    console.error(`resolveRepository(${owner}/${repo}) failed:`, error);
    return {
      status: "error",
      message: "Something went wrong analyzing that repository.",
    };
  }

  redirect(`/lore/${owner}/${repo}`);
}

export type ReanalyzeState =
  | { status: "idle" }
  | { status: "done"; changed: boolean }
  | { status: "error"; message: string };

/**
 * Server Action backing the "Re-analyze" button on `/lore/{owner}/{repo}`
 * (acceptance criterion 11, session 11). Bound to `owner`/`repo` via
 * `.bind()` since the button isn't a plain form with those as field values.
 * Reports honestly whether the re-run actually produced a new analysis or
 * short-circuited on an unchanged commit (ADR-0005), rather than a generic
 * "done" that could look like a no-op silently succeeded.
 */
// Required by useActionState's action signature; owner/repo (bound ahead of
// these two) are what this action actually needs.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function reanalyzeRepository(
  owner: string,
  repo: string,
  _prevState: ReanalyzeState,
  _formData: FormData
): Promise<ReanalyzeState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const previousRun = await getLatestAnalysisRunForRepo(owner, repo);

  let run;
  try {
    run = await analyzeAndPersistRepository(owner, repo);
  } catch (error) {
    if (error instanceof GitHubApiError || error instanceof RateLimitedError) {
      return { status: "error", message: error.message };
    }
    console.error(`reanalyzeRepository(${owner}/${repo}) failed:`, error);
    return {
      status: "error",
      message: "Something went wrong re-analyzing that repository.",
    };
  }

  revalidatePath(`/lore/${owner}/${repo}`);
  return { status: "done", changed: run.id !== previousRun?.id };
}
