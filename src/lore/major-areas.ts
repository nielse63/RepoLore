import type { StructuralArea } from "./model";

/**
 * The structural areas presented as Major Areas: all but the root directory
 * (`"."` — files with no directory of their own, e.g. root-level config),
 * which adds no orientation value as its own area. Every page and every
 * count (meta descriptions, Open Graph cards, `/explore`, indexability)
 * uses this so none can disagree with what the Overview lists. The SQL in
 * `listLatestRunIndexabilityFacts` mirrors it.
 */
export function majorAreasOf(areas: StructuralArea[]): StructuralArea[] {
  return areas.filter((area) => area.name !== ".");
}
