import type { EntityId, SourceLocation, StructuralArea } from "./model";

/**
 * A directed edge between two structural areas, resolved from
 * `StructuralArea.directDependencyIds` (already computed by
 * `src/analysis/shared/derive-views.ts` from file-level `depends-on`
 * relationships). Presentation-layer only — see ADR-0008: no new evidence
 * is produced here, no new analyzer capability is required.
 */
export interface AreaRelationship {
  fromAreaId: EntityId;
  fromAreaName: string;
  fromAreaLocation: SourceLocation;
  toAreaId: EntityId;
  toAreaName: string;
  toAreaLocation: SourceLocation;
}

/**
 * Resolves each area's `directDependencyIds` into a flat, de-duplicated list
 * of area-to-area edges. Every edge is backed entirely by `detected`
 * file-level `depends-on` relationships — the only kind
 * `directDependencyIds` is ever built from — so no separate certainty is
 * tracked per edge (see ADR-0008).
 */
export function deriveAreaRelationships(
  structuralAreas: StructuralArea[]
): AreaRelationship[] {
  const areaById = new Map(structuralAreas.map((area) => [area.id, area]));
  const seen = new Set<string>();
  const edges: AreaRelationship[] = [];

  for (const area of structuralAreas) {
    for (const dependencyId of area.directDependencyIds) {
      const dependency = areaById.get(dependencyId);
      if (!dependency) continue;
      const key = `${area.id}->${dependency.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        fromAreaId: area.id,
        fromAreaName: area.name,
        fromAreaLocation: area.location,
        toAreaId: dependency.id,
        toAreaName: dependency.name,
        toAreaLocation: dependency.location,
      });
    }
  }

  return edges;
}
