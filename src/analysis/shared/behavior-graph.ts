/**
 * Generic graph algorithms over the Program Behavior Graph (ADR-0013),
 * operating on plain `EntityId`s so they work identically for
 * `CallableSignature` and `BehaviorNode` ids. Mirrors
 * `src/lore/call-graph-layout.ts`'s existing `buildAdjacency`/BFS style
 * rather than introducing a graph library — the codebase has twice
 * (ADR-0009, ADR-0012) rejected one for surfaces this small.
 *
 * No general graph library is used here either: these primitives back
 * function-importance scoring across the whole analyzed system (potentially
 * thousands of functions), not a single bounded UI subgraph, so each
 * function documents its own complexity (prompt §17) rather than assuming
 * dagre-sized inputs.
 */

import type { EntityId } from "@/lore/model";
import {
  PAGERANK_DAMPING,
  PAGERANK_ITERATIONS,
  REACHABILITY_DECAY,
  REACHABILITY_MIN_WEIGHT,
} from "./function-importance-config";

export interface DirectedEdgeLike {
  source: EntityId;
  target: EntityId;
}

export interface DirectedAdjacency {
  /** id -> ids it has an edge *to*. */
  outgoing: Map<EntityId, EntityId[]>;
  /** id -> ids it has an edge *from*. */
  incoming: Map<EntityId, EntityId[]>;
}

/** O(E). */
export function buildDirectedAdjacency(
  edges: DirectedEdgeLike[]
): DirectedAdjacency {
  const outgoing = new Map<EntityId, EntityId[]>();
  const incoming = new Map<EntityId, EntityId[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [
      ...(outgoing.get(edge.source) ?? []),
      edge.target,
    ]);
    incoming.set(edge.target, [
      ...(incoming.get(edge.target) ?? []),
      edge.source,
    ]);
  }
  return { outgoing, incoming };
}

export interface ReachabilityResult {
  /** Reached id -> distance-decayed weight (prompt §6: `0.7^(distance-1)`). Excludes `fromId` itself. */
  weightById: Map<EntityId, number>;
  /** Sum of `weightById`'s values — a single decayed-reachability figure for `fromId`. */
  totalWeight: number;
}

/**
 * Breadth-first traversal from `fromId` outward along `outgoing`, weighting
 * each newly-reached node by `REACHABILITY_DECAY^(distance-1)` and stopping
 * once a hop's weight drops below `REACHABILITY_MIN_WEIGHT` (empirically ~8
 * hops at the default decay) — bounding cost instead of walking the entire
 * reachable set regardless of how little a distant node contributes. A
 * visited set prevents cycles from being revisited or double-counted, and
 * each node's weight reflects its *shortest* distance from `fromId` (BFS
 * visits nodes in non-decreasing distance order, and a node is only ever
 * weighted the first time it's reached).
 *
 * Complexity: O(V + E) per call in the worst case (bounded further in
 * practice by the depth cap on sparse graphs); called once per function
 * during scoring, so O(V * (V + E)) overall for the whole system — see
 * ADR-0013's known limitations for why this is accepted rather than
 * memoized further.
 */
export function decayedReachability(
  fromId: EntityId,
  outgoing: Map<EntityId, EntityId[]>
): ReachabilityResult {
  const weightById = new Map<EntityId, number>();
  const visited = new Set<EntityId>([fromId]);
  let frontier = outgoing.get(fromId) ?? [];
  let distance = 1;

  while (frontier.length > 0) {
    const weight = REACHABILITY_DECAY ** (distance - 1);
    if (weight < REACHABILITY_MIN_WEIGHT) break;

    const nextFrontier: EntityId[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      weightById.set(id, weight);
      nextFrontier.push(...(outgoing.get(id) ?? []));
    }
    frontier = nextFrontier;
    distance += 1;
  }

  let totalWeight = 0;
  for (const weight of weightById.values()) totalWeight += weight;
  return { weightById, totalWeight };
}

/** O(1) amortized (array length lookup). */
export function fanIn(
  id: EntityId,
  incoming: Map<EntityId, EntityId[]>
): number {
  return incoming.get(id)?.length ?? 0;
}

/** O(1) amortized. */
export function fanOut(
  id: EntityId,
  outgoing: Map<EntityId, EntityId[]>
): number {
  return outgoing.get(id)?.length ?? 0;
}

/**
 * A simplified PageRank (power iteration, prompt §11) over `nodeIds`, using
 * `outgoing` for transitions. When `seedIds` is given and non-empty, the
 * teleport/dangling-mass distribution is concentrated on those ids instead
 * of uniform — a personalized PageRank seeded from entry points, so
 * functions reachable from real entry points accumulate more rank than
 * equally-connected functions that aren't. Standard dangling-node handling
 * (a node with no outgoing edges) redistributes its rank mass through the
 * same teleport distribution each iteration, avoiding rank leakage.
 *
 * Not exact betweenness centrality — betweenness (Brandes' algorithm) is
 * O(V * E) and deliberately deferred (ADR-0013 §11/§17); PageRank is one
 * signal among several feeding `structuralCentrality`, never the whole
 * dimension.
 *
 * Complexity: O(PAGERANK_ITERATIONS * (V + E)).
 */
export function simplePageRank(
  nodeIds: EntityId[],
  outgoing: Map<EntityId, EntityId[]>,
  seedIds?: EntityId[]
): Map<EntityId, number> {
  const n = nodeIds.length;
  if (n === 0) return new Map();

  const nodeIdSet = new Set(nodeIds);
  const validSeeds = (seedIds ?? []).filter((id) => nodeIdSet.has(id));

  const teleport = new Map<EntityId, number>();
  if (validSeeds.length > 0) {
    const share = 1 / validSeeds.length;
    for (const id of nodeIds) teleport.set(id, 0);
    for (const id of validSeeds) teleport.set(id, share);
  } else {
    const share = 1 / n;
    for (const id of nodeIds) teleport.set(id, share);
  }

  let current = new Map<EntityId, number>(nodeIds.map((id) => [id, 1 / n]));

  for (let iteration = 0; iteration < PAGERANK_ITERATIONS; iteration++) {
    const next = new Map<EntityId, number>(nodeIds.map((id) => [id, 0]));
    let danglingMass = 0;

    for (const id of nodeIds) {
      const outIds = outgoing.get(id) ?? [];
      const rank = current.get(id) ?? 0;
      if (outIds.length === 0) {
        danglingMass += rank;
        continue;
      }
      const share = rank / outIds.length;
      for (const target of outIds) {
        if (!next.has(target)) continue;
        next.set(target, next.get(target)! + share);
      }
    }

    for (const id of nodeIds) {
      const teleportShare = teleport.get(id) ?? 0;
      const value =
        (1 - PAGERANK_DAMPING) * teleportShare +
        PAGERANK_DAMPING * ((next.get(id) ?? 0) + danglingMass * teleportShare);
      next.set(id, value);
    }
    current = next;
  }

  return current;
}
