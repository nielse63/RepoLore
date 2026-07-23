/**
 * Manual sanity check that the JS/TS analyzer runs unmodified against a
 * real, fetched GitHub repository instead of a local fixture (session 8:
 * "swap the JS/TS analyzer's input from local fixtures to a fetched
 * repo"). No automated test suite yet — see implementation-plan.md session
 * 15.
 *
 * Usage: npm run analyze-repo -- <github-repository-url>
 * Requires GITHUB_TOKEN (see .env.example); npm run analyze-repo already
 * loads .env.local if present.
 */

import { acquireRepositorySource } from '../src/acquisition/fetch-repo-source';
import { deriveJsTsViews } from '../src/analysis/js-ts/derive-views';
import { extractJsTsProject } from '../src/analysis/js-ts/extract-project';
import { parseGitHubRepoUrl } from '../src/github/parse-repo-url';

const target = process.argv[2];
if (!target) {
  console.error('Usage: npm run analyze-repo -- <github-repository-url>');
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
    const extraction = extractJsTsProject(acquired.dir);
    const { structuralAreas, startHere } = deriveJsTsViews({
      projectId: extraction.project.id,
      ...extraction,
    });

    console.log('\nProject:', JSON.stringify(extraction.project, null, 2));

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
        `  ${area.name}${area.responsibility ? ` — ${area.responsibility}` : ''}`
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
