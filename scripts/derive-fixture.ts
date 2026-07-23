/**
 * Manual sanity check for the Start Here / major-area derived views against
 * a fixture directory (no automated test suite yet — see
 * implementation-plan.md session 15).
 *
 * Usage: npm run derive -- fixtures/ts-react-app
 */

import { deriveJsTsViews } from "../src/analysis/js-ts/derive-views";
import { extractJsTsProject } from "../src/analysis/js-ts/extract-project";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run derive -- <path-to-fixture>");
  process.exit(1);
}

const extraction = extractJsTsProject(target);
const { structuralAreas, startHere } = deriveJsTsViews({
  projectId: extraction.project.id,
  ...extraction,
});

console.log(`Start Here (${startHere.length}):`);
for (const item of startHere) {
  console.log(`  ${item.order}. [${item.certainty}] ${item.location.filePath}`);
  console.log(`     ${item.whatItRepresents}`);
  console.log(`     ${item.rationale}`);
}

console.log(`\nMajor areas (${structuralAreas.length}):`);
for (const area of structuralAreas) {
  console.log(`  ${area.name}${area.responsibility ? ` — ${area.responsibility}` : ""}`);
  console.log(`     ${area.rationale}`);
  console.log(
    `     entry points: ${area.entryPointIds.length}, depends on: ${area.directDependencyIds.length}, depended on by: ${area.directDependentIds.length}, tests: ${area.testRelationshipIds.length}, gaps: ${area.gaps.length}`,
  );
}
