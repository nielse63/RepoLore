import type { StructuralArea } from "./model";

/**
 * The three labels `AreaDependencyDiagram.tsx` already uses for
 * `StructuralArea.responsibility` (ADR-0009's `RESPONSIBILITY_STYLES`),
 * reused verbatim here rather than inventing a new vocabulary (e.g.
 * "Core"/"Primary") for the Systems page (ADR-0014). A criticality-sounding
 * label would read as a business-importance judgment the analysis can't
 * back up — nothing computed here measures usage, importance, or dependency
 * centrality, only whether `responsibility` matches the same closed,
 * already-established set `derive-views.ts`'s `NON_PRIMARY_AREA_RESPONSIBILITIES`
 * uses to exclude test/tooling areas from Start Here's padding step. This is
 * a presentation-layer bucket over an existing field, not a new evidence
 * claim or certainty category.
 */
export type SystemClassification =
  | "Implementation area"
  | "Tests / test support"
  | "Build/tooling configuration";

const CLASSIFICATION_BY_RESPONSIBILITY: Record<string, SystemClassification> = {
  Tests: "Tests / test support",
  "Test fixtures/support data": "Tests / test support",
  "Build/tooling configuration": "Build/tooling configuration",
};

/**
 * Classifies a Major Area for Systems-page presentation (ADR-0014). An area
 * with no special `responsibility`, or an unrecognized future one, falls
 * back to "Implementation area" — the same default `AreaDependencyDiagram`
 * already applies.
 */
export function classifySystem(area: StructuralArea): SystemClassification {
  if (!area.responsibility) return "Implementation area";
  return (
    CLASSIFICATION_BY_RESPONSIBILITY[area.responsibility] ??
    "Implementation area"
  );
}
