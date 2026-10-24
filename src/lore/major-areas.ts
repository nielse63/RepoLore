import type { StructuralArea } from "./model";
import { classifySystem } from "./system-classification";

/**
 * The structural areas presented as Major Areas: all but the root directory
 * (`"."` — files with no directory of their own, e.g. root-level config),
 * which adds no orientation value as its own area. Every page and every
 * count (meta descriptions, Open Graph cards, `/explore`, indexability)
 * uses this so none can disagree with what the Overview lists. The SQL in
 * `listLatestRunIndexabilityFacts` mirrors it.
 *
 * Returns areas in their persisted (alphabetical) order, which slug
 * assignment (`assignSystemSlugs`) depends on — use `rankMajorAreas` for the
 * order a list presents them in.
 */
export function majorAreasOf(areas: StructuralArea[]): StructuralArea[] {
  return areas.filter((area) => area.name !== ".");
}

const directRelationshipCount = (area: StructuralArea) =>
  area.directDependencyIds.length + area.directDependentIds.length;

/**
 * The one-line note shown above a ranked Major Areas list, so the order is
 * explainable from the page. Relationship counts reflect only imports the
 * syntactic analysis resolved — a 0 can mean "unknown", not "none" — so when
 * no listed area has a detected relationship, the note says the order comes
 * from entry points and name instead of implying relationships were compared.
 */
export function majorAreasOrderNote(areas: StructuralArea[]): string {
  return areas.some((area) => directRelationshipCount(area) > 0)
    ? "Ordered by detected direct relationships (depends on + imported by), then entry points, then name; tests and tooling configuration are listed last."
    : "No direct relationships between areas were detected, so areas are listed by entry points, then name; tests and tooling configuration are listed last.";
}

/**
 * Presentation order for Major Area lists (GitHub issue #48), so the first
 * page leads with the areas that have the most detected connections to the
 * rest of the codebase, rather than whatever sorts first alphabetically:
 *
 * 1. Implementation areas before tests/test-support and tooling
 *    configuration (`classifySystem`, the Systems page's own buckets).
 * 2. More direct area relationships (depends on + imported by) first.
 * 3. More entry points first.
 * 4. Name (fixed "en" collation, so the server and browser renders of a
 *    client component agree), for a stable order among equals.
 *
 * Every key is a count already shown on each card, so the order is
 * explainable from what's on screen — a reading-order heuristic over
 * detected relationships, not an importance or health judgment.
 */
export function compareMajorAreas(a: StructuralArea, b: StructuralArea) {
  const nonPrimary = (area: StructuralArea) =>
    classifySystem(area) === "Implementation area" ? 0 : 1;
  return (
    nonPrimary(a) - nonPrimary(b) ||
    directRelationshipCount(b) - directRelationshipCount(a) ||
    b.entryPointIds.length - a.entryPointIds.length ||
    a.name.localeCompare(b.name, "en")
  );
}

export function rankMajorAreas(areas: StructuralArea[]): StructuralArea[] {
  return [...areas].sort(compareMajorAreas);
}
