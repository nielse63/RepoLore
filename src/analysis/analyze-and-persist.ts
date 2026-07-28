/**
 * Orchestrates the full synchronous analysis path for a real GitHub
 * repository (ADR-0001/ADR-0004: no worker/job queue yet): resolve the
 * repo's HEAD, short-circuit if that exact commit+analyzer-version has
 * already been run (ADR-0005 idempotency — avoids redundant tarball
 * fetch/extraction on repeat submissions), otherwise acquire the source,
 * extract, derive views, and persist the result. Failures at every stage
 * are persisted as an honest `'failed'` run rather than left unrecorded, so
 * `/lore/{owner}/{repo}` always has something evidence-backed to render.
 *
 * Every call (the initial home-page submission and session 11's manual
 * re-analyze action both go through this one function) is rate-limited per
 * repo before anything else happens — see `claimReanalysisAttempt`.
 */

import { acquireRepositorySource } from "@/acquisition/fetch-repo-source";
import { deriveJsTsViews } from "@/analysis/js-ts/derive-views";
import { extractJsTsProject } from "@/analysis/js-ts/extract-project";
import { claimReanalysisAttempt } from "@/analysis/reanalysis-rate-limit";
import { JS_TS_ANALYZER_VERSION } from "@/analysis/js-ts/version";
import {
  getAnalysisRunByKey,
  saveAnalysisRun,
  type AnalysisRunRow,
} from "@/db/analysis-runs";
import { upsertRepo } from "@/db/repos";
import { resolveRepositoryHead } from "@/github/client";
import { buildLore } from "@/lore/build-lore";

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function analyzeAndPersistRepository(
  owner: string,
  repo: string
): Promise<AnalysisRunRow> {
  const repoRow = await upsertRepo(owner, repo);
  await claimReanalysisAttempt(repoRow.id);

  // Resolution failures (repo doesn't exist, bad token, ...) have no commit
  // to key a run on, so they're left to the caller rather than persisted.
  const { defaultBranch, headSha, description } = await resolveRepositoryHead(
    owner,
    repo
  );

  const existing = await getAnalysisRunByKey(
    repoRow.id,
    headSha,
    JS_TS_ANALYZER_VERSION
  );
  if (existing) return existing;

  let acquired;
  try {
    acquired = await acquireRepositorySource(owner, repo);
  } catch (error) {
    return saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: headSha,
      analyzerVersion: JS_TS_ANALYZER_VERSION,
      status: "failed",
      errorMessage: errorMessageOf(error),
    });
  }

  try {
    const extraction = extractJsTsProject(acquired.dir);
    const views = deriveJsTsViews({
      projectId: extraction.project.id,
      ...extraction,
    });
    const lore = buildLore({
      owner,
      repo,
      defaultBranch,
      description,
      commitSha: acquired.headSha,
      analyzerVersion: JS_TS_ANALYZER_VERSION,
      analyzedAt: new Date().toISOString(),
      extraction,
      views,
    });

    return await saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: acquired.headSha,
      analyzerVersion: JS_TS_ANALYZER_VERSION,
      status: lore.snapshot.status,
      result: lore,
    });
  } catch (error) {
    return saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: acquired.headSha,
      analyzerVersion: JS_TS_ANALYZER_VERSION,
      status: "failed",
      errorMessage: errorMessageOf(error),
    });
  } finally {
    await acquired.cleanup();
  }
}
