/**
 * Tunable constants for function importance scoring (ADR-0013), isolated
 * from `function-importance.ts`'s scoring logic so weights can be adjusted
 * without touching the algorithm itself (prompt §5's "keep weighting
 * configuration isolated so it can be tuned later").
 */

import type { FunctionImportanceVector } from "@/lore/model";

/** Weights applied to each vector dimension to produce the final 0–100 score. Must sum to 1. */
export const IMPORTANCE_WEIGHTS: Record<
  keyof FunctionImportanceVector,
  number
> = {
  reachability: 0.2,
  orchestration: 0.2,
  dataInfluence: 0.15,
  stateAuthority: 0.15,
  boundaryInfluence: 0.15,
  structuralCentrality: 0.15,
};

/**
 * Per-hop decay applied when propagating a function's reachability outward
 * (prompt §6): `weight = REACHABILITY_DECAY ** (distance - 1)`, so a
 * distance-1 descendant contributes 1.0, distance-2 contributes 0.7, etc.
 */
export const REACHABILITY_DECAY = 0.7;

/**
 * Traversal stops once a hop's decay weight drops below this threshold —
 * bounds `decayedReachability`'s cost on large graphs (prompt §17) instead
 * of walking every reachable node regardless of diminishing contribution.
 * At `REACHABILITY_DECAY = 0.7`, this caps traversal at 8 hops
 * (0.7^7 ≈ 0.082, 0.7^8 ≈ 0.057).
 */
export const REACHABILITY_MIN_WEIGHT = 0.06;

/** Iteration count for the simplified PageRank power iteration (prompt §11). */
export const PAGERANK_ITERATIONS = 20;

/** Standard PageRank damping factor. */
export const PAGERANK_DAMPING = 0.85;

/**
 * `STATE_WRITE`/`STATE_CREATE`/`STATE_DELETE`-shaped edges count more than
 * `STATE_READ` toward state authority (prompt §9); this codebase only
 * distinguishes read vs. write for now (see ADR-0013's known limitations).
 */
export const STATE_WRITE_WEIGHT = 1;
export const STATE_READ_WEIGHT = 0.35;

/** A `shared` state node (read/written from more than one function) counts more than a `local` one (prompt §9). */
export const STATE_SHARED_MULTIPLIER = 1.6;
export const STATE_LOCAL_MULTIPLIER = 1;
