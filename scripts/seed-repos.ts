/**
 * Pre-analyzes a list of popular repositories so
 * there are Lore pages to index and share. Operator-run by hand only — never
 * scheduled (docs/product/non-goals.md); pull-triggered refresh (ADR-0013)
 * keeps them current from there. Runs one repository at a time through the
 * same `analyzeAndPersistRepository` path a home-page submission uses, and
 * skips any repository whose latest run is under a day old.
 *
 * Usage: npm run seed [-- <list-file>]   (default: scripts/seed-repos.txt)
 * Requires GITHUB_TOKEN and DATABASE_URL (see .env.example); already loads
 * .env.local if present.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { analyzeAndPersistRepository } from "../src/analysis/analyze-and-persist";
import { RateLimitedError } from "../src/analysis/reanalysis-rate-limit";
import { getLatestAnalysisRunForRepo } from "../src/db/analysis-runs";
import { getDbPool } from "../src/db/client";
import { parseGitHubRepoUrl } from "../src/github/parse-repo-url";
import isAnalysisStale from "../src/helpers/is-analysis-stale";

const listFile =
  process.argv[2] ?? path.join(process.cwd(), "scripts/seed-repos.txt");

async function main() {
  const entries = (await fs.readFile(listFile, "utf-8"))
    .split("\n")
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean);

  const tally = { analyzed: 0, skipped: 0, failed: 0 };

  for (const entry of entries) {
    const parsed = parseGitHubRepoUrl(entry);
    if (!parsed.ok) {
      console.error(`✗ ${entry}: ${parsed.reason}`);
      tally.failed++;
      continue;
    }
    const { owner, repo } = parsed.value;

    const latest = await getLatestAnalysisRunForRepo(owner, repo);
    if (latest && !isAnalysisStale(latest.createdAt)) {
      console.log(`- ${owner}/${repo}: analyzed under a day ago, skipped`);
      tally.skipped++;
      continue;
    }

    const startedAt = Date.now();
    try {
      const run = await analyzeAndPersistRepository(owner, repo);
      const seconds = Math.round((Date.now() - startedAt) / 1000);
      const detail = run.errorMessage ? ` — ${run.errorMessage}` : "";
      console.log(`✓ ${owner}/${repo}: ${run.status} (${seconds}s)${detail}`);
      if (run.status === "failed") tally.failed++;
      else tally.analyzed++;
    } catch (error) {
      if (error instanceof RateLimitedError) {
        console.log(`- ${owner}/${repo}: rate-limited, skipped`);
        tally.skipped++;
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${owner}/${repo}: ${message}`);
      tally.failed++;
    }
  }

  console.log(
    `\nDone: ${tally.analyzed} analyzed, ${tally.skipped} skipped, ${tally.failed} failed.`
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => getDbPool().end());
