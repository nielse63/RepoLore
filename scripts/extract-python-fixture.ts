/**
 * Manual sanity check for Python project extraction against a fixture
 * directory (no automated test suite yet — see implementation-plan.md
 * session 15).
 *
 * Usage: npm run extract-python -- fixtures/python-app
 */

import { extractPythonProject } from "../src/analysis/python/extract-project";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run extract-python -- <path-to-fixture>");
  process.exit(1);
}

extractPythonProject(target)
  .then((result) => {
    console.log("Project:", JSON.stringify(result.project, null, 2));

    console.log(`\nSource files (${result.sourceFilePaths.length}):`);
    for (const filePath of result.sourceFilePaths) {
      console.log(`  ${filePath}`);
    }

    console.log(`\nEntry points (${result.entryPoints.length}):`);
    for (const ep of result.entryPoints) {
      console.log(`  [${ep.certainty}] ${ep.kind} -> ${ep.location.filePath}`);
    }

    console.log(
      `\nInternal dependency relationships (${result.relationships.length}):`
    );
    for (const rel of result.relationships) {
      console.log(
        `  [${rel.certainty}] ${rel.fromId} --${rel.kind}--> ${rel.toId}`
      );
    }

    console.log(`\nPublic contracts (${result.publicContracts.length}):`);
    for (const contract of result.publicContracts) {
      console.log(
        `  [${contract.evidence[0]?.certainty}] ${contract.location.filePath} exports '${contract.name}'`
      );
    }

    console.log(`\nTest relationships (${result.testRelationships.length}):`);
    for (const testRel of result.testRelationships) {
      console.log(
        `  [${testRel.certainty}] ${testRel.testLocation.filePath} -> ${testRel.implementationLocation.filePath}`
      );
    }

    console.log(`\nGaps (${result.gaps.length}):`);
    for (const gap of result.gaps) {
      console.log(`  [${gap.certainty}] ${gap.description}`);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
