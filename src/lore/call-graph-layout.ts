import dagre from "@dagrejs/dagre";
import type {
  CallableSignature,
  CallEdge,
  EntityId,
  SourceLocation,
} from "./model";

/**
 * A single rendered subgraph never exceeds this many nodes (ADR-0012,
 * mirroring `MAX_DIAGRAM_AREAS`'s role in ADR-0009). The UI never renders
 * the whole repository's call graph at once — only one function's local
 * neighborhood, computed fresh per focus change (see `deriveCallGraphLayout`).
 */
export const MAX_CALL_GRAPH_NODES = 40;

const NODE_WIDTH = 220;
const NODE_HEIGHT = 60;

export interface CallGraphNode {
  id: EntityId;
  name: string;
  kind: CallableSignature["kind"];
  location: SourceLocation;
  isFocus: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CallGraphDiagramEdge {
  fromId: EntityId;
  toId: EntityId;
  points: { x: number; y: number }[];
}

export interface CallGraphLayout {
  width: number;
  height: number;
  nodes: CallGraphNode[];
  edges: CallGraphDiagramEdge[];
  /**
   * `true` when the focused function's full transitive caller/callee chain
   * exceeded `MAX_CALL_GRAPH_NODES` and the UI fell back to direct
   * callers/callees only (one hop) — callers should disclose this rather
   * than silently show a partial chain (ADR-0012, mirroring
   * `deriveAreaDiagramLayout`'s table-only fallback in ADR-0009).
   */
  truncated: boolean;
}

function buildAdjacency(edges: CallEdge[]) {
  const callersOf = new Map<EntityId, EntityId[]>();
  const calleesOf = new Map<EntityId, EntityId[]>();
  for (const edge of edges) {
    callersOf.set(edge.calleeId, [
      ...(callersOf.get(edge.calleeId) ?? []),
      edge.callerId,
    ]);
    calleesOf.set(edge.callerId, [
      ...(calleesOf.get(edge.callerId) ?? []),
      edge.calleeId,
    ]);
  }
  return { callersOf, calleesOf };
}

function bfsReachable(
  focusId: EntityId,
  callersOf: Map<EntityId, EntityId[]>,
  calleesOf: Map<EntityId, EntityId[]>
): Set<EntityId> {
  const visited = new Set<EntityId>([focusId]);
  const queue = [focusId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [
      ...(callersOf.get(current) ?? []),
      ...(calleesOf.get(current) ?? []),
    ];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }
  return visited;
}

/**
 * Computes a bounded, dagre-laid-out subgraph of the call graph centered on
 * one focused function: its full transitive callers and callees in both
 * directions, up to `MAX_CALL_GRAPH_NODES`. Above that cap, falls back to
 * the focus function's direct callers/callees only (one hop), with
 * `truncated: true` so the UI can disclose it (ADR-0012). Returns `null`
 * when `focusId` doesn't match any known callable.
 */
export function deriveCallGraphLayout(
  focusId: EntityId,
  signatures: CallableSignature[],
  edges: CallEdge[]
): CallGraphLayout | null {
  const byId = new Map(signatures.map((s) => [s.id, s]));
  if (!byId.has(focusId)) return null;

  const { callersOf, calleesOf } = buildAdjacency(edges);
  const fullReachable = bfsReachable(focusId, callersOf, calleesOf);

  let nodeIds: EntityId[];
  let truncated = false;
  if (fullReachable.size <= MAX_CALL_GRAPH_NODES) {
    nodeIds = [...fullReachable];
  } else {
    truncated = true;
    const oneHop = new Set<EntityId>([
      focusId,
      ...(callersOf.get(focusId) ?? []),
      ...(calleesOf.get(focusId) ?? []),
    ]);
    nodeIds = [...oneHop].slice(0, MAX_CALL_GRAPH_NODES);
  }

  const nodeIdSet = new Set(nodeIds);
  const relevantEdges = edges.filter(
    (edge) => nodeIdSet.has(edge.callerId) && nodeIdSet.has(edge.calleeId)
  );

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 72 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const id of nodeIds) {
    graph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of relevantEdges) {
    graph.setEdge(edge.callerId, edge.calleeId);
  }

  dagre.layout(graph);
  const graphLabel = graph.graph();

  const nodes: CallGraphNode[] = nodeIds.map((id) => {
    const signature = byId.get(id)!;
    const { x, y } = graph.node(id);
    return {
      id,
      name: signature.name,
      kind: signature.kind,
      location: signature.location,
      isFocus: id === focusId,
      x: x - NODE_WIDTH / 2,
      y: y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };
  });

  const diagramEdges: CallGraphDiagramEdge[] = relevantEdges.map((edge) => {
    const graphEdge = graph.edge(edge.callerId, edge.calleeId);
    return {
      fromId: edge.callerId,
      toId: edge.calleeId,
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
    truncated,
  };
}
