import dagre from "@dagrejs/dagre";
import type { AreaRelationship } from "./area-relationships";
import { deriveProductionAreaRelationships } from "./area-relationships";
import type {
  EntityId,
  Relationship,
  SourceLocation,
  StructuralArea,
} from "./model";

/**
 * Above this many nodes, a layered diagram stops being readable at a glance
 * (see ADR-0009), so a larger graph shows only this many connected areas —
 * the ones with the most detected relationships — and the caller's caption
 * points to the full Component Connections table.
 */
export const MAX_DIAGRAM_AREAS = 30;

const NODE_WIDTH = 200;
const NODE_HEIGHT = 56;

export interface AreaDiagramNode {
  id: EntityId;
  name: string;
  responsibility?: string;
  location: SourceLocation;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AreaDiagramEdge {
  fromId: EntityId;
  toId: EntityId;
  points: { x: number; y: number }[];
}

/** An area with no edge to any other area in the diagram (GitHub issue #51). */
export interface AreaDiagramUnconnectedArea {
  id: EntityId;
  name: string;
  location: SourceLocation;
}

export interface AreaDiagramLayout {
  width: number;
  height: number;
  nodes: AreaDiagramNode[];
  edges: AreaDiagramEdge[];
  unconnected: AreaDiagramUnconnectedArea[];
  /** Areas with at least one edge; more than `nodes.length` when truncated. */
  connectedAreaCount: number;
}

/**
 * Computes a static, non-interactive layered layout for a Major-Area
 * dependency diagram, using `@dagrejs/dagre` for position/edge-routing only
 * — no new relationship data, no analysis capability, presentation-layer
 * only (see ADR-0009, mirroring ADR-0008's `deriveAreaRelationships`).
 * Areas with no edge to another given area are left out of the dagre graph
 * and returned as `unconnected` instead: dagre would otherwise put every one
 * of them in the top rank beside the real roots, widening the diagram until
 * `fitView` can't fit it (GitHub issue #51).
 *
 * Above `MAX_DIAGRAM_AREAS` connected areas, only that many are laid out:
 * `pinnedAreaId` (a System subview's own area) first, then by detected
 * relationships — distinct neighbor areas, in or out, counted over these
 * same edges, so the selection can be checked against what's drawn — then
 * by name. Only edges between shown areas are kept.
 *
 * Returns `null` when there's nothing meaningful to draw (fewer than two
 * areas, or no edges between them).
 */
export function deriveAreaDiagramLayout(
  areas: StructuralArea[],
  edges: AreaRelationship[],
  pinnedAreaId?: EntityId
): AreaDiagramLayout | null {
  if (areas.length < 2) return null;

  const areaIds = new Set(areas.map((area) => area.id));
  const relevantEdges = edges.filter(
    (edge) => areaIds.has(edge.fromAreaId) && areaIds.has(edge.toAreaId)
  );
  if (relevantEdges.length === 0) return null;

  const neighbors = new Map<EntityId, Set<EntityId>>();
  for (const edge of relevantEdges) {
    for (const [a, b] of [
      [edge.fromAreaId, edge.toAreaId],
      [edge.toAreaId, edge.fromAreaId],
    ]) {
      const areaNeighbors = neighbors.get(a) ?? new Set<EntityId>();
      areaNeighbors.add(b);
      neighbors.set(a, areaNeighbors);
    }
  }
  const connectedAreas = areas.filter((area) => neighbors.has(area.id));
  const degree = (area: StructuralArea) => neighbors.get(area.id)?.size ?? 0;
  const selectedIds = new Set(
    [...connectedAreas]
      .sort(
        (a, b) =>
          Number(b.id === pinnedAreaId) - Number(a.id === pinnedAreaId) ||
          degree(b) - degree(a) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, MAX_DIAGRAM_AREAS)
      .map((area) => area.id)
  );
  const shownEdges = relevantEdges.filter(
    (edge) => selectedIds.has(edge.fromAreaId) && selectedIds.has(edge.toAreaId)
  );
  // A selected area whose only neighbors were left out has nothing to draw.
  const shownIds = new Set(
    shownEdges.flatMap((edge) => [edge.fromAreaId, edge.toAreaId])
  );
  const shownAreas = connectedAreas.filter((area) => shownIds.has(area.id));

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const area of shownAreas) {
    graph.setNode(area.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of shownEdges) {
    graph.setEdge(edge.fromAreaId, edge.toAreaId);
  }

  dagre.layout(graph);

  const graphLabel = graph.graph();
  const areaById = new Map(areas.map((area) => [area.id, area]));

  const nodes: AreaDiagramNode[] = shownAreas.map((area) => {
    const { x, y } = graph.node(area.id);
    return {
      id: area.id,
      name: area.name,
      responsibility: area.responsibility,
      location: area.location,
      x: x - NODE_WIDTH / 2,
      y: y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  const diagramEdges: AreaDiagramEdge[] = shownEdges.map((edge) => {
    const fromArea = areaById.get(edge.fromAreaId)!;
    const toArea = areaById.get(edge.toAreaId)!;
    const graphEdge = graph.edge(edge.fromAreaId, edge.toAreaId);
    return {
      fromId: fromArea.id,
      toId: toArea.id,
      points: graphEdge.points.map((point: { x: number; y: number }) => ({
        x: point.x,
        y: point.y,
      })),
    };
  });

  return {
    width: graphLabel.width ?? 0,
    height: graphLabel.height ?? 0,
    nodes,
    edges: diagramEdges,
    unconnected: areas
      .filter((area) => !neighbors.has(area.id))
      .map((area) => ({
        id: area.id,
        name: area.name,
        location: area.location,
      })),
    connectedAreaCount: connectedAreas.length,
  };
}

/**
 * `deriveAreaDiagramLayout`, restricted to production files: areas with no
 * production files (all-test directories) are dropped as nodes entirely,
 * and edges are re-derived from raw file-level `relationships` via
 * `deriveProductionAreaRelationships` so an edge never appears solely
 * because of a test file's import. Used by `AreaDependencyDiagram` itself
 * and by each page that embeds it, so the "should we show a diagram at all"
 * gating check and what actually renders can never disagree.
 *
 * `productionFilePaths` is treated as possibly absent (`?? []`) because a
 * persisted `analysis_runs` row from before this field existed won't have
 * it — falling back to "no known production files" degrades that stale
 * result to no diagram (same as too-few-areas today) rather than crashing
 * the page; re-analyzing repopulates it.
 */
export function deriveProductionAreaDiagramLayout(
  areas: StructuralArea[],
  relationships: Relationship[],
  pinnedAreaId?: EntityId
): AreaDiagramLayout | null {
  const productionAreas = areas.filter(
    (area) => (area.productionFilePaths ?? []).length > 0
  );
  const productionRelationships = deriveProductionAreaRelationships(
    productionAreas,
    relationships
  );
  return deriveAreaDiagramLayout(
    productionAreas,
    productionRelationships,
    pinnedAreaId
  );
}
