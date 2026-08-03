import dagre from "@dagrejs/dagre";
import type { AreaRelationship } from "./area-relationships";
import type { EntityId, SourceLocation, StructuralArea } from "./model";

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
