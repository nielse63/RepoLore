import type {
  EntityId,
  Relationship,
  SourceLocation,
  StructuralArea,
} from "./model";

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

/**
 * Same shape as `deriveAreaRelationships`, but resolved directly from raw
 * file-level `relationships` and each area's `productionFilePaths` instead
 * of the already-rolled-up `directDependencyIds` — so an edge only appears
 * when a *production* file in one area actually depends on a *production*
 * file in another. Built for the area dependency diagram specifically: an
 * edge that exists only because a test file (e.g. a colocated
 * `__tests__/foo.test.ts` sitting in an otherwise-production area) imports
 * something in another area is excluded, rather than misrepresented as a
 * production dependency. Other consumers of area relationships (the
 * "Component Connections" table) intentionally keep using
 * `deriveAreaRelationships` and its full, test-inclusive picture.
 */
export function deriveProductionAreaRelationships(
  structuralAreas: StructuralArea[],
  relationships: Relationship[]
): AreaRelationship[] {
  const areaByProductionFile = new Map<string, StructuralArea>();
  for (const area of structuralAreas) {
    // `?? []`: a persisted analysis from before this field existed won't
    // have it — see deriveProductionAreaDiagramLayout's doc comment.
    for (const filePath of area.productionFilePaths ?? []) {
      areaByProductionFile.set(filePath, area);
    }
  }

  const seen = new Set<string>();
  const edges: AreaRelationship[] = [];

  for (const rel of relationships) {
    const fromArea = areaByProductionFile.get(rel.fromId);
    const toArea = areaByProductionFile.get(rel.toId);
    if (!fromArea || !toArea || fromArea.id === toArea.id) continue;
    const key = `${fromArea.id}->${toArea.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({
      fromAreaId: fromArea.id,
      fromAreaName: fromArea.name,
      fromAreaLocation: fromArea.location,
      toAreaId: toArea.id,
      toAreaName: toArea.name,
      toAreaLocation: toArea.location,
    });
  }

  return edges;
}
