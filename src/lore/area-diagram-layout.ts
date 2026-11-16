import dagre from "@dagrejs/dagre";
import type { AreaRelationship } from "./area-relationships";
import { deriveProductionAreaRelationships } from "./area-relationships";
import { compareMajorAreas } from "./major-areas";
import type {
  EntityId,
  Relationship,
  SourceLocation,
  StructuralArea,
} from "./model";

/**
 * Above this many nodes, a layered diagram stops being readable at a glance
 * (see ADR-0009), so even "Show all areas" shows at most this many connected
 * areas, and the caller's caption points to the full Component Connections
 * table.
 */
export const MAX_DIAGRAM_AREAS = 30;

/**
 * How many connected areas the diagram shows before "Show all areas"
 * (GitHub issue #79): a readable first view at full label size, rather than
 * shrinking every label to fit the whole graph.
 */
export const DEFAULT_DIAGRAM_AREAS = 8;

const NODE_WIDTH = 200;
const NODE_HEIGHT = 64;

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
 * Above `limit` connected areas (capped at `MAX_DIAGRAM_AREAS`), only that
 * many are laid out: `pinnedAreaId` (a System subview's own area) first,
 * then in Major Areas order (`compareMajorAreas`, the order every Major
 * Areas list already presents and explains — GitHub issue #79; it replaced
 * a count of drawn production edges, so the default and "Show all" subsets
 * share one explainable order). That order counts all detected direct
 * relationships, test-inclusive, so a listed area can have fewer drawn
 * arrows than its rank suggests. Only edges between shown areas are kept,
 * and a shown area left with no edge is dropped.
 *
 * Returns `null` when there's nothing meaningful to draw (fewer than two
 * areas, or no edges between them).
 */
export function deriveAreaDiagramLayout(
  areas: StructuralArea[],
  edges: AreaRelationship[],
  pinnedAreaId?: EntityId,
  limit: number = MAX_DIAGRAM_AREAS
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
  const selectedIds = new Set(
    [...connectedAreas]
      .sort(
        (a, b) =>
          Number(b.id === pinnedAreaId) - Number(a.id === pinnedAreaId) ||
          compareMajorAreas(a, b)
      )
      .slice(0, Math.min(limit, MAX_DIAGRAM_AREAS))
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
  pinnedAreaId?: EntityId,
  limit?: number
): AreaDiagramLayout | null {
  const { productionAreas, productionRelationships } =
    deriveProductionAreaGraph(
      pinnedAreaId ? systemNeighborhoodAreas(areas, pinnedAreaId) : areas,
      relationships
    );
  return deriveAreaDiagramLayout(
    productionAreas,
    productionRelationships,
    pinnedAreaId,
    limit
  );
}

/**
 * The areas with production files and the production-only area edges
 * between them — the graph `deriveProductionAreaDiagramLayout` lays out, and
 * what the diagram's inspector lists as an area's imports and importers, so
 * the two can't disagree.
 */
export function deriveProductionAreaGraph(
  areas: StructuralArea[],
  relationships: Relationship[]
): {
  productionAreas: StructuralArea[];
  productionRelationships: AreaRelationship[];
} {
  const productionAreas = areas.filter(
    (area) => (area.productionFilePaths ?? []).length > 0
  );
  return {
    productionAreas,
    productionRelationships: deriveProductionAreaRelationships(
      productionAreas,
      relationships
    ),
  };
}

/**
 * A System subview's diagram scope: the system's own area plus every area
 * it directly depends on or is depended on by (its rolled-up, test-inclusive
 * `directDependencyIds`/`directDependentIds`). The production layout then
 * draws only the production edges among them.
 */
export function systemNeighborhoodAreas(
  areas: StructuralArea[],
  areaId: EntityId
): StructuralArea[] {
  const area = areas.find((candidate) => candidate.id === areaId);
  if (!area) return [];
  const ids = new Set([
    area.id,
    ...area.directDependencyIds,
    ...area.directDependentIds,
  ]);
  return areas.filter((candidate) => ids.has(candidate.id));
}

/**
 * An SVG path through dagre's routed edge points (GitHub issue #79): a
 * quadratic curve bent at each interior point and joined at the midpoints
 * between them, so it stays inside the hull of dagre's polyline — which
 * already routes around nodes — instead of react-flow's own handle-to-handle
 * curves, which ignore other nodes. It starts and ends exactly at dagre's
 * end points, on the node borders, so the arrowhead lands on the target.
 */
export function smoothEdgePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let path = `M ${first.x} ${first.y}`;
  if (rest.length === 1) return `${path} L ${rest[0].x} ${rest[0].y}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const control = rest[i];
    const next = rest[i + 1];
    const end =
      i === rest.length - 2
        ? next
        : { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 };
    path += ` Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  return path;
}

/** The id react-flow and `areaNeighborhood` use for a drawn edge. */
export function areaEdgeId(edge: { fromId: EntityId; toId: EntityId }) {
  return `${edge.fromId}->${edge.toId}`;
}

/**
 * The one-hop neighborhood "Focus on selected area" keeps undimmed (GitHub
 * issue #79): the selected area, every area a drawn edge connects it to in
 * either direction, and those edges. Edges between two neighbors aren't
 * included — the focus stays on the selected area's direct relationships,
 * never a multi-hop or transitive view. An id with no drawn edge (or not on
 * the map) yields just itself.
 */
export function areaNeighborhood(
  edges: AreaDiagramEdge[],
  areaId: EntityId
): { nodeIds: Set<EntityId>; edgeIds: Set<string> } {
  const nodeIds = new Set<EntityId>([areaId]);
  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (edge.fromId !== areaId && edge.toId !== areaId) continue;
    nodeIds.add(edge.fromId);
    nodeIds.add(edge.toId);
    edgeIds.add(areaEdgeId(edge));
  }
  return { nodeIds, edgeIds };
}
