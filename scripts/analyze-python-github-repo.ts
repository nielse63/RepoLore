/**
 * Manual sanity check that the Python analyzer + derived views run against a
 * real, fetched GitHub repository instead of a local fixture
 * (implementation-plan.md session 13's real-repo validation pass).
 *
 * Usage: npm run analyze-python-repo -- <github-repository-url>
 * Requires GITHUB_TOKEN (see .env.example); npm run analyze-python-repo
 * already loads .env.local if present.
 */

import { acquireRepositorySource } from "../src/acquisition/fetch-repo-source";
import { derivePythonViews } from "../src/analysis/python/derive-views";
import { extractPythonProject } from "../src/analysis/python/extract-project";
import { parseGitHubRepoUrl } from "../src/github/parse-repo-url";

const target = process.argv[2];
if (!target) {
  console.error(
    "Usage: npm run analyze-python-repo -- <github-repository-url>"
  );
  process.exit(1);
}

const parsed = parseGitHubRepoUrl(target);
if (!parsed.ok) {
  console.error(`Invalid repository: ${parsed.reason}`);
  process.exit(1);
}
const { owner, repo } = parsed.value;

async function main() {
  console.log(`Resolving and fetching ${owner}/${repo}...`);
  const acquired = await acquireRepositorySource(owner, repo);
  console.log(
    `Fetched ${acquired.owner}/${acquired.repo}@${acquired.headSha} ` +
      `(default branch ${acquired.defaultBranch}, ${acquired.fileCount} files) -> ${acquired.dir}`
  );

  try {
    const extraction = await extractPythonProject(acquired.dir);
    const { structuralAreas, startHere } = derivePythonViews({
      projectId: extraction.project.id,
      ...extraction,
    });

    console.log("\nProject:", JSON.stringify(extraction.project, null, 2));

    console.log(`\nStart Here (${startHere.length}):`);
    for (const item of startHere) {
      console.log(
        `  ${item.order}. [${item.certainty}] ${item.location.filePath}`
      );
      console.log(`     ${item.whatItRepresents}`);
      console.log(`     ${item.rationale}`);
    }

    console.log(`\nMajor areas (${structuralAreas.length}):`);
    for (const area of structuralAreas) {
      console.log(
        `  ${area.name}${area.responsibility ? ` — ${area.responsibility}` : ""}`
      );
    }

    console.log(`\nEntry points (${extraction.entryPoints.length}):`);
    for (const ep of extraction.entryPoints) {
      console.log(`  [${ep.certainty}] ${ep.kind} -> ${ep.location.filePath}`);
    }

    console.log(`\nGaps (${extraction.gaps.length}):`);
    for (const gap of extraction.gaps) {
      console.log(`  [${gap.certainty}] ${gap.description}`);
    }
  } finally {
    await acquired.cleanup();
    console.log(`\nCleaned up ${acquired.dir}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
