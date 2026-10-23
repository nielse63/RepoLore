/**
 * Seeds a local database with the persisted runs the Playwright suite reads,
 * built from local source rather than GitHub — so `npm run test:e2e` can run
 * against a fresh, throwaway Postgres (CI's service container, or a
 * developer's `docker compose` db) with no `GITHUB_TOKEN` and no shared
 * database:
 *
 * - `nielse63/repo-lore-ts-react-app-fixture` — the pinned fixture most
 *   specs read, analyzed from `fixtures/ts-react-app` (the repository's
 *   published content) and keyed to its real HEAD commit. An empty History
 *   cache is saved alongside it, so the History page never calls GitHub.
 * - `nielse63/RepoLore` — this repository's own committed tree (`git
 *   archive HEAD`, the same shape as a GitHub tarball), which has more than
 *   one page of Major Areas for `major-areas-pagination.spec.ts`.
 * - `nielse63/repo-lore-ts-nested-test-samples-fixture` — analyzed from
 *   `fixtures/ts-nested-test-samples`, a monorepo package whose test suite
 *   nests many one-file sample-case directories under `packages/core/tests`
 *   (GitHub issue #50's Svelte-shaped layout), plus a test-named
 *   `packages/test` helper package that production code imports, for
 *   `nested-test-samples.spec.ts`. Local-only: unlike the other fixtures it
 *   has no GitHub repository, so it's keyed to a fixed placeholder commit.
 *   Its run is `'completed'` and indexable, so `/explore` and the sitemap
 *   list it alongside the other seeded runs. Its History cache is built by
 *   the real classifier (`buildHistoryEntries`) from recorded GitHub
 *   commit-detail payloads in `fixtures/history-commits` (a lockfile-only
 *   bump and a `package.json` edit, for `history-dependencies.spec.ts`), so
 *   its History page never calls GitHub either.
 *
 * Every run is stamped `analyzedAt: now`, so viewing them doesn't schedule
 * an ADR-0013 background re-analysis. Idempotent per ADR-0005: re-running
 * against an already-seeded database leaves existing runs untouched.
 *
 * Refuses to run against a non-local `DATABASE_URL`, since it writes runs
 * that didn't come from a real analysis of GitHub's copy.
 *
 * Usage: npm run seed:e2e
 * Requires DATABASE_URL (see .env.example), already migrated.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildAnalyzerVersion } from "../src/analysis/dispatch/version";
import { deriveJsTsViews } from "../src/analysis/js-ts/derive-views";
import { extractJsTsProject } from "../src/analysis/js-ts/extract-project";
import { saveAnalysisRun } from "../src/db/analysis-runs";
import { getDbPool } from "../src/db/client";
import { saveHistoryEntries } from "../src/db/history-entries";
import { upsertRepo } from "../src/db/repos";
import type { CommitDetail, CommitSummary } from "../src/github/commits";
import { buildHistoryEntries } from "../src/history/classify";
import { buildLore } from "../src/lore/build-lore";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** `nielse63/repo-lore-ts-react-app-fixture`'s HEAD on GitHub, matching `fixtures/ts-react-app`. */
const TS_REACT_APP_FIXTURE_SHA = "50857b9860ee568f54a6707098761857932ab02f";

/** Placeholder: `fixtures/ts-nested-test-samples` has no GitHub repository. */
const TS_NESTED_TEST_SAMPLES_FIXTURE_SHA =
  "0000000000000000000000000000000000000050";

async function seedRun(params: {
  owner: string;
  repo: string;
  dir: string;
  commitSha: string;
  description?: string;
}) {
  const { owner, repo, dir, commitSha, description } = params;
  const analyzerVersion = buildAnalyzerVersion(["js-ts"]);
  const extraction = extractJsTsProject(dir, "js-ts");
  const views = deriveJsTsViews({ projectId: "js-ts", ...extraction });
  const lore = buildLore({
    owner,
    repo,
    defaultBranch: "main",
    description,
    isPrivate: false,
    commitSha,
    analyzerVersion,
    analyzedAt: new Date().toISOString(),
    extractions: [{ extraction, views }],
  });

  const repoRow = await upsertRepo(owner, repo);
  const run = await saveAnalysisRun({
    repoId: repoRow.id,
    commitSha,
    analyzerVersion,
    status: lore.snapshot.status,
    result: lore,
  });
  console.log(
    `✓ ${owner}/${repo}@${commitSha.slice(0, 7)} ${analyzerVersion}: ${run.status}`
  );
  return { repoRow, lore };
}

/** GitHub's `GET /repos/{owner}/{repo}/commits/{sha}` payload, plus how many days before seeding it was authored. */
interface RecordedCommit {
  sha: string;
  commit: { message: string; author: { name: string } };
  author?: { login: string };
  daysAgo: number;
  files: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }[];
}

async function readRecordedCommits(
  file: string
): Promise<{ commit: CommitSummary; detail: CommitDetail }[]> {
  const recorded = JSON.parse(
    await fs.readFile(file, "utf-8")
  ) as RecordedCommit[];
  return recorded.map((c) => ({
    commit: {
      sha: c.sha,
      message: c.commit.message,
      authorName: c.commit.author.name,
      authorLogin: c.author?.login,
      authoredAt: new Date(
        Date.now() - c.daysAgo * 24 * 60 * 60 * 1000
      ).toISOString(),
    },
    detail: {
      sha: c.sha,
      files: c.files.map((f) => ({
        filePath: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })),
    },
  }));
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL is configured.");
  const { hostname } = new URL(url);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to seed e2e data into a non-local database (${hostname}).`
    );
  }

  const { repoRow: fixtureRepo } = await seedRun({
    owner: "nielse63",
    repo: "repo-lore-ts-react-app-fixture",
    dir: path.join(process.cwd(), "fixtures/ts-react-app"),
    commitSha: TS_REACT_APP_FIXTURE_SHA,
  });
  await saveHistoryEntries({
    repoId: fixtureRepo.id,
    computedThroughSha: TS_REACT_APP_FIXTURE_SHA,
    entries: [],
  });

  const nested = await seedRun({
    owner: "nielse63",
    repo: "repo-lore-ts-nested-test-samples-fixture",
    dir: path.join(process.cwd(), "fixtures/ts-nested-test-samples"),
    commitSha: TS_NESTED_TEST_SAMPLES_FIXTURE_SHA,
  });
  await saveHistoryEntries({
    repoId: nested.repoRow.id,
    computedThroughSha: TS_NESTED_TEST_SAMPLES_FIXTURE_SHA,
    entries: buildHistoryEntries(
      await readRecordedCommits(
        path.join(
          process.cwd(),
          "fixtures/history-commits/dependency-commits.json"
        )
      ),
      nested.lore
    ),
  });

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "repolore-seed-e2e-"));
  try {
    const headSha = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf-8",
    }).trim();
    const archive = path.join(tmp, "head.tar");
    const tree = path.join(tmp, "tree");
    await fs.mkdir(tree);
    execFileSync("git", ["archive", "--output", archive, "HEAD"]);
    execFileSync("tar", ["-xf", archive, "-C", tree]);
    await seedRun({
      owner: "nielse63",
      repo: "RepoLore",
      dir: tree,
      commitSha: headSha,
      description:
        "Repo Lore builds a living, evidence-backed mental model of a software repository.",
    });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDbPool().end());
