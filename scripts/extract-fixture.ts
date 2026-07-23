/**
 * Manual sanity check for JS/TS project extraction against a fixture
 * directory (no automated test suite yet — see implementation-plan.md
 * session 15).
 *
 * Usage: npm run extract -- fixtures/ts-react-app
 */

import { extractJsTsProject } from "../src/analysis/js-ts/extract-project";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run extract -- <path-to-fixture>");
  process.exit(1);
}

const result = extractJsTsProject(target);

console.log("Project:", JSON.stringify(result.project, null, 2));

console.log(`\nEntry points (${result.entryPoints.length}):`);
for (const ep of result.entryPoints) {
  console.log(`  [${ep.certainty}] ${ep.kind} -> ${ep.location.filePath}`);
}

console.log(`\nInternal dependency relationships (${result.relationships.length}):`);
for (const rel of result.relationships) {
  console.log(`  [${rel.certainty}] ${rel.fromId} --${rel.kind}--> ${rel.toId}`);
}

console.log(`\nPublic contracts (${result.publicContracts.length}):`);
for (const contract of result.publicContracts) {
  console.log(`  ${contract.location.filePath} exports '${contract.name}'`);
}

console.log(`\nTest relationships (${result.testRelationships.length}):`);
for (const testRel of result.testRelationships) {
  console.log(
    `  [${testRel.certainty}] ${testRel.testLocation.filePath} -> ${testRel.implementationLocation.filePath}`,
  );
}

console.log(`\nReact components (${result.reactComponents.length}):`);
for (const component of result.reactComponents) {
  console.log(`  ${component.location.filePath}: ${component.name}`);
}

console.log(`\nGaps (${result.gaps.length}):`);
for (const gap of result.gaps) {
  console.log(`  [${gap.certainty}] ${gap.description}`);
}
