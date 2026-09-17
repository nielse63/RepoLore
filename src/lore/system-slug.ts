import type { StructuralArea } from "./model";

function kebabCase(input: string): string {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "area";
}

export interface SystemSlugEntry {
  area: StructuralArea;
  slug: string;
}

/**
 * Assigns each area a kebab-case slug (from `StructuralArea.name`) for its
 * Systems subview URL (ADR-0014). Collisions — two areas with the same name,
 * e.g. the same directory basename in different projects of a mixed-language
 * repository — are broken with a numeric suffix in array order.
 *
 * Slugs are stable only within one analysis run's area list: a subsequent
 * re-analysis that adds, removes, or renames areas can shift which area a
 * given slug resolves to, and therefore what a previously bookmarked or
 * shared `/systems/{slug}` URL points at. This mirrors the existing looseness
 * of area identity across re-analyses; it isn't a new guarantee this
 * function is expected to provide.
 */
export function assignSystemSlugs(areas: StructuralArea[]): SystemSlugEntry[] {
  const counts = new Map<string, number>();
  return areas.map((area) => {
    const base = kebabCase(area.name);
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    const slug = seen === 0 ? base : `${base}-${seen + 1}`;
    return { area, slug };
  });
}

/** Resolves a Systems subview slug back to its `StructuralArea`, if any. */
export function findAreaBySlug(
  areas: StructuralArea[],
  slug: string
): StructuralArea | undefined {
  return assignSystemSlugs(areas).find((entry) => entry.slug === slug)?.area;
}
