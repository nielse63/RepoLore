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
 * — callers should fall back to the existing table-only presentation
 * instead (see ADR-0009).
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

export interface AreaDiagramLayout {
  width: number;
  height: number;
  nodes: AreaDiagramNode[];
  edges: AreaDiagramEdge[];
}

/**
 * Computes a static, non-interactive layered layout for a Major-Area
 * dependency diagram, using `@dagrejs/dagre` for position/edge-routing only
 * — no new relationship data, no analysis capability, presentation-layer
 * only (see ADR-0009, mirroring ADR-0008's `deriveAreaRelationships`).
 * Returns `null` when there's nothing meaningful to draw (fewer than two
 * areas) or when there are too many areas to stay readable
 * (`MAX_DIAGRAM_AREAS`) — callers should fall back to a table in that case.
 */
export function deriveAreaDiagramLayout(
  areas: StructuralArea[],
  edges: AreaRelationship[]
): AreaDiagramLayout | null {
  if (areas.length < 2 || areas.length > MAX_DIAGRAM_AREAS) return null;

  const areaIds = new Set(areas.map((area) => area.id));
  const relevantEdges = edges.filter(
    (edge) => areaIds.has(edge.fromAreaId) && areaIds.has(edge.toAreaId)
  );

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: 32, ranksep: 56 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const area of areas) {
    graph.setNode(area.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of relevantEdges) {
    graph.setEdge(edge.fromAreaId, edge.toAreaId);
  }

  dagre.layout(graph);

  const graphLabel = graph.graph();
  const areaById = new Map(areas.map((area) => [area.id, area]));

  const nodes: AreaDiagramNode[] = areas.map((area) => {
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

  const diagramEdges: AreaDiagramEdge[] = relevantEdges.map((edge) => {
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
  relationships: Relationship[]
): AreaDiagramLayout | null {
  const productionAreas = areas.filter(
    (area) => (area.productionFilePaths ?? []).length > 0
  );
  const productionRelationships = deriveProductionAreaRelationships(
    productionAreas,
    relationships
  );
  return deriveAreaDiagramLayout(productionAreas, productionRelationships);
}
