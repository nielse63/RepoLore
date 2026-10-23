import type { CallableSignature, EntityId, FunctionImportance } from "./model";

/**
 * Orders functions for the Data Flow page's Importance sort (and its default
 * focus, GitHub issue #7): highest `FunctionImportance.score` first, then by
 * name so ties — and functions with no importance entry, ranked as 0 — have
 * a stable, deterministic order. Returns a new array.
 */
export function rankByImportance(
  signatures: CallableSignature[],
  importanceById: Map<EntityId, FunctionImportance>
): CallableSignature[] {
  return [...signatures].sort(
    (a, b) =>
      (importanceById.get(b.id)?.score ?? 0) -
        (importanceById.get(a.id)?.score ?? 0) || a.name.localeCompare(b.name)
  );
}
