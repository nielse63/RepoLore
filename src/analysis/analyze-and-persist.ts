/**
 * Orchestrates the full synchronous analysis path for a real GitHub
 * repository (ADR-0001/ADR-0004: no worker/job queue yet): resolve the
 * repo's HEAD and GitHub's byte-weighted language breakdown, decide which
 * analyzer(s) to run (ADR-0007's dispatch — `detectLanguages`), short-
 * circuit if that exact commit+analyzer-set has already been run
 * (ADR-0005 idempotency — avoids redundant tarball fetch/extraction on
 * repeat submissions), otherwise acquire the source, run every selected
 * extractor, merge their output, and persist the result. Failures at every
 * stage are persisted as an honest `'failed'` run rather than left
 * unrecorded, so `/lore/{owner}/{repo}` always has something evidence-backed
 * to render — including a repository whose primary language(s) no analyzer
 * supports, which is persisted as `'failed'` with a plain explanation
 * rather than silently analyzed as the wrong language or shown as empty.
 *
 * Every call (the initial home-page submission and session 11's manual
 * re-analyze action both go through this one function) is rate-limited per
 * repo before anything else happens — see `claimReanalysisAttempt`.
 */

import { acquireRepositorySource } from "@/acquisition/fetch-repo-source";
import {
  detectLanguages,
  type SupportedAnalyzer,
} from "@/analysis/dispatch/detect-languages";
import { buildAnalyzerVersion } from "@/analysis/dispatch/version";
import { deriveJsTsViews } from "@/analysis/js-ts/derive-views";
import { extractJsTsProject } from "@/analysis/js-ts/extract-project";
import { derivePythonViews } from "@/analysis/python/derive-views";
import { extractPythonProject } from "@/analysis/python/extract-project";
import { claimReanalysisAttempt } from "@/analysis/reanalysis-rate-limit";
import type { DerivedViews } from "@/analysis/shared/derive-views";
import {
  getAnalysisRunByKey,
  saveAnalysisRun,
  type AnalysisRunRow,
} from "@/db/analysis-runs";
import { upsertRepo } from "@/db/repos";
import {
  fetchRepositoryLanguages,
  resolveRepositoryHead,
} from "@/github/client";
import { buildLore, type BuildLoreProjectInput } from "@/lore/build-lore";
import type { Gap } from "@/lore/model";
import { enrichExternalDependencyDescriptions } from "@/registry/enrich-descriptions";

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs one analyzer against the acquired source, returning the pair `buildLore` needs. Namespaced by `projectId` (the analyzer's own key) so a mixed-language run's structural-area IDs can't collide across languages (ADR-0007). */
async function runAnalyzer(
  analyzer: SupportedAnalyzer,
  dir: string
): Promise<BuildLoreProjectInput> {
  if (analyzer === "python") {
    const extraction = await extractPythonProject(dir, analyzer);
    const views: DerivedViews = derivePythonViews({
      projectId: analyzer,
      ...extraction,
    });
    return { extraction, views };
  }

  const extraction = extractJsTsProject(dir, analyzer);
  const views: DerivedViews = deriveJsTsViews({
    projectId: analyzer,
    ...extraction,
  });
  return { extraction, views };
}

/** A plain-language explanation of why no analyzer ran, naming GitHub's actual top language(s) rather than leaving the repository looking silently empty or wrong. */
function unsupportedLanguageMessage(
  owner: string,
  repo: string,
  languageShares: ReturnType<typeof detectLanguages>["languageShares"]
): string {
  const top = languageShares[0];
  const subject = `${owner}/${repo}`;
  const reason = top
    ? `${subject}'s primary language is ${top.language} (${Math.round(top.share * 100)}% of classified source)`
    : `GitHub did not report any classified source for ${subject} — it may be empty`;
  return `Repo Lore currently analyzes JavaScript, TypeScript, and Python only. ${reason}, so no supported analyzer could produce a result.`;
}

/**
 * Tarball entries skipped during extraction (ADR-0002: symlinks, hardlinks,
 * devices, FIFOs — anything that isn't a regular file or directory) aren't
 * an extraction failure, but they are real, disclosed gaps in what got
 * analyzed, so they're surfaced the same way any other analyzer gap is.
 * Collapsed to one gap rather than one per entry so a repository with many
 * symlinks (e.g. a monorepo's shared config) doesn't flood the Lore with
 * near-duplicate gaps.
 */
function skippedEntryGaps(
  skippedEntries: { path: string; type: string }[]
): Gap[] {
  if (skippedEntries.length === 0) return [];
  const examples = skippedEntries
    .slice(0, 5)
    .map((e) => `'${e.path}' (${e.type})`);
  const suffix =
    skippedEntries.length > examples.length
      ? `, and ${skippedEntries.length - examples.length} more`
      : "";
  return [
    {
      certainty: "unsupported",
      description: `${skippedEntries.length} tarball ${skippedEntries.length === 1 ? "entry was" : "entries were"} skipped during extraction because they weren't a regular file or directory (e.g. a symbolic link): ${examples.join(", ")}${suffix}. These paths were not analyzed.`,
    },
  ];
}

export async function analyzeAndPersistRepository(
  owner: string,
  repo: string
): Promise<AnalysisRunRow> {
  const repoRow = await upsertRepo(owner, repo);
  await claimReanalysisAttempt(repoRow.id);

  // Resolution failures (repo doesn't exist, bad token, ...) have no commit
  // to key a run on, so they're left to the caller rather than persisted.
  const [{ defaultBranch, headSha, description, isPrivate }, languageBytes] =
    await Promise.all([
      resolveRepositoryHead(owner, repo),
      fetchRepositoryLanguages(owner, repo),
    ]);

  const detection = detectLanguages(languageBytes);
  const analyzerVersion = buildAnalyzerVersion(
    detection.selectedAnalyzers.map((a) => a.analyzer)
  );

  const existing = await getAnalysisRunByKey(
    repoRow.id,
    headSha,
    analyzerVersion
  );
  if (existing) return existing;

  if (!detection.supported) {
    return saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: headSha,
      analyzerVersion,
      status: "failed",
      errorMessage: unsupportedLanguageMessage(
        owner,
        repo,
        detection.languageShares
      ),
    });
  }

  let acquired;
  try {
    acquired = await acquireRepositorySource(owner, repo);
  } catch (error) {
    return saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: headSha,
      analyzerVersion,
      status: "failed",
      errorMessage: errorMessageOf(error),
    });
  }

  try {
    const extractions: BuildLoreProjectInput[] = [];
    for (const { analyzer } of detection.selectedAnalyzers) {
      extractions.push(await runAnalyzer(analyzer, acquired.dir));
    }

    await enrichExternalDependencyDescriptions(
      extractions.flatMap((e) => e.extraction.externalDependencies)
    );

    const lore = buildLore({
      owner,
      repo,
      defaultBranch,
      description,
      isPrivate,
      commitSha: acquired.headSha,
      analyzerVersion,
      analyzedAt: new Date().toISOString(),
      extractions,
      acquisitionGaps: skippedEntryGaps(acquired.skippedEntries),
    });

    return await saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: acquired.headSha,
      analyzerVersion,
      status: lore.snapshot.status,
      result: lore,
    });
  } catch (error) {
    return saveAnalysisRun({
      repoId: repoRow.id,
      commitSha: acquired.headSha,
      analyzerVersion,
      status: "failed",
      errorMessage: errorMessageOf(error),
    });
  } finally {
    await acquired.cleanup();
  }
}
