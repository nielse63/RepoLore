/**
 * Manual sanity check for the Start Here / major-area derived views against
 * a Python fixture directory (implementation-plan.md session 13).
 *
 * Usage: npm run derive-python -- fixtures/python-app
 */

import { derivePythonViews } from "../src/analysis/python/derive-views";
import { extractPythonProject } from "../src/analysis/python/extract-project";

const target = process.argv[2];
if (!target) {
  console.error("Usage: npm run derive-python -- <path-to-fixture>");
  process.exit(1);
}

extractPythonProject(target)
  .then((extraction) => {
    const { structuralAreas, startHere } = derivePythonViews({
      projectId: extraction.project.id,
      ...extraction,
    });

    console.log(`Start Here (${startHere.length}):`);
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
      console.log(`     ${area.rationale}`);
      console.log(
        `     entry points: ${area.entryPointIds.length}, depends on: ${area.directDependencyIds.length}, depended on by: ${area.directDependentIds.length}, tests: ${area.testRelationshipIds.length}, gaps: ${area.gaps.length}`
      );
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
