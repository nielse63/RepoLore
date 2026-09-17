import type {
  CallableSignature,
  CallEdge,
  EntityId,
  EntryPoint,
  PublicContract,
} from "./model";

function locationKey(filePath: string, symbolName: string): string {
  return `${filePath}#${symbolName}`;
}

/**
 * Resolves entities that carry a (filePath, symbolName) location — entry
 * points and public-contract evidence — to the one `CallableSignature`
 * declared at that same location. Ambiguous matches (more than one
 * same-named callable in the same file) are skipped, same discipline as
 * `call-graph.ts`'s call resolution and
 * `function-importance.ts#matchEntryPointsToFunctions`.
 */
function resolveByLocation(
  byLocation: Map<string, CallableSignature[]>,
  filePath: string,
  symbolName: string | undefined
): CallableSignature | undefined {
  if (!symbolName) return undefined;
  const matches = byLocation.get(locationKey(filePath, symbolName));
  return matches && matches.length === 1 ? matches[0] : undefined;
}

/**
 * The Chain tab's tree roots (product decision, 2026-08-26): the union of
 * exported (`PublicContract`) and framework/runtime (`EntryPoint`) functions,
 * so the same tree generalizes across library-style repos (exports) and
 * app-style repos (routes/handlers/server actions/CLI/bootstrap/UI events).
 * Falls back to every function with zero detected callers (fan-in 0) when
 * that union is empty, and further to every function when even that is empty
 * (a fully-cyclic graph with no acyclic entry) — the tree is never silently
 * empty absent a genuine absence of functions.
 */
export function deriveCallTreeRootIds(
  callableSignatures: CallableSignature[],
  callEdges: CallEdge[],
  publicContracts: PublicContract[],
  entryPoints: EntryPoint[]
): EntityId[] {
  if (callableSignatures.length === 0) return [];

  const byLocation = new Map<string, CallableSignature[]>();
  for (const signature of callableSignatures) {
    if (!signature.location.symbolName) continue;
    const key = locationKey(
      signature.location.filePath,
      signature.location.symbolName
    );
    byLocation.set(key, [...(byLocation.get(key) ?? []), signature]);
  }

  const roots = new Set<EntityId>();

  for (const entryPoint of entryPoints) {
    const match = resolveByLocation(
      byLocation,
      entryPoint.location.filePath,
      entryPoint.location.symbolName
    );
    if (match) roots.add(match.id);
  }

  for (const contract of publicContracts) {
    if (contract.kind !== "export") continue;
    const declared = contract.evidence[0]?.location;
    if (!declared) continue;
    const match = resolveByLocation(
      byLocation,
      declared.filePath,
      declared.symbolName
    );
    if (match) roots.add(match.id);
  }

  if (roots.size === 0) {
    const hasCaller = new Set(callEdges.map((e) => e.calleeId));
    for (const signature of callableSignatures) {
      if (!hasCaller.has(signature.id)) roots.add(signature.id);
    }
  }

  if (roots.size === 0) {
    for (const signature of callableSignatures) roots.add(signature.id);
  }

  const byId = new Map(callableSignatures.map((s) => [s.id, s]));
  return [...roots].sort((a, b) =>
    (byId.get(a)?.name ?? "").localeCompare(byId.get(b)?.name ?? "")
  );
}

/** Caller -> deduped callee ids, for on-demand tree expansion (a caller may call the same callee at multiple call sites, but the tree shows each distinct callee once). */
export function buildCalleesIndex(
  callEdges: CallEdge[]
): Map<EntityId, EntityId[]> {
  const seen = new Map<EntityId, Set<EntityId>>();
  for (const edge of callEdges) {
    const callees = seen.get(edge.callerId) ?? new Set<EntityId>();
    callees.add(edge.calleeId);
    seen.set(edge.callerId, callees);
  }
  return new Map([...seen].map(([id, callees]) => [id, [...callees]]));
}

/**
 * Resolves a list of `CallEdge`s to the distinct `CallableSignature`s at
 * `pick(edge)`, in first-occurrence order. A function can have more than one
 * call edge to (or from) the same other function — e.g. two call sites to
 * the same callee within one body — so this de-dupes on the resolved
 * signature's id, same discipline `buildCalleesIndex` uses for the tree
 * view's per-caller callee lists. Used by the Data Flow focus panel's
 * "Called by"/"Calls" lists.
 */
export function resolveUniqueSignatures(
  edges: CallEdge[],
  pick: (edge: CallEdge) => EntityId,
  byId: Map<EntityId, CallableSignature>
): CallableSignature[] {
  const seen = new Set<EntityId>();
  const result: CallableSignature[] = [];
  for (const edge of edges) {
    const id = pick(edge);
    if (seen.has(id)) continue;
    seen.add(id);
    const signature = byId.get(id);
    if (signature) result.push(signature);
  }
  return result;
}
