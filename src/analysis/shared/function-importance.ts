/**
 * Function importance scoring (ADR-0013): for every `CallableSignature`, a
 * six-dimension `FunctionImportanceVector`, an overall `score`, inferred
 * `FunctionRole`s, and structured `ImportanceReason`s — computed once,
 * language-neutrally, over an already-assembled `Lore`'s arrays (mirroring
 * `derive-views.ts`'s shared/per-language split, so this is ready for
 * Python's call graph whenever that ships).
 *
 * "Module" here means a file path (`SourceLocation.filePath`) — the
 * model's existing, ubiquitous unit of code organization — rather than a
 * `StructuralArea`, keeping this module's only inputs the graph itself and
 * `EntryPoint`s, with no dependency on area-derivation having already run.
 *
 * Every dimension is normalized 0–100 *relative to the analyzed system*:
 * each dimension's raw values are divided by that dimension's own maximum
 * across all functions, so scores are only ever comparable within one
 * analysis run, never across repositories (prompt §5).
 */

import type {
  BehaviorEdge,
  BehaviorNode,
  BoundaryType,
  CallableSignature,
  EntityId,
  EntryPoint,
  EntryPointKind,
  FunctionImportance,
  FunctionImportanceVector,
  FunctionRole,
  ImportanceReason,
  StateScope,
} from "@/lore/model";
import {
  buildDirectedAdjacency,
  decayedReachability,
  fanIn,
  fanOut,
  simplePageRank,
} from "./behavior-graph";
import { IMPORTANCE_WEIGHTS } from "./function-importance-config";

/** A dimension score of 60+/100 is treated as "this signal clearly fired" for role/reason purposes — an explainable, tunable threshold, not a statistical cutoff. */
const SIGNAL_THRESHOLD = 60;
const MAX_REASON_ITEMS_PER_KIND = 3;

function normalizeToScale(raw: number[]): number[] {
  const max = Math.max(0, ...raw);
  if (max <= 0) return raw.map(() => 0);
  return raw.map((v) => Math.round((v / max) * 100));
}

function normalizeToUnit(raw: number[]): number[] {
  const max = Math.max(0, ...raw);
  if (max <= 0) return raw.map(() => 0);
  return raw.map((v) => v / max);
}

/**
 * Matches `EntryPoint`s to a `CallableSignature` by (filePath, symbolName).
 * File-level entry points with no `symbolName` (e.g. a package's bare "main"
 * field, or the ReactDOM-bootstrap heuristic) can't be attributed to one
 * specific function and are skipped — an honest gap, not a guess. Ambiguous
 * matches (more than one same-named callable in the same file) are also
 * skipped, for the same reason `call-graph.ts`'s call resolution skips them.
 */
function matchEntryPointsToFunctions(
  entryPoints: EntryPoint[],
  callableSignatures: CallableSignature[]
): Map<EntityId, EntryPointKind[]> {
  const byLocation = new Map<string, CallableSignature[]>();
  for (const signature of callableSignatures) {
    const key = `${signature.location.filePath}#${signature.location.symbolName ?? ""}`;
    byLocation.set(key, [...(byLocation.get(key) ?? []), signature]);
  }

  const result = new Map<EntityId, EntryPointKind[]>();
  for (const entryPoint of entryPoints) {
    if (!entryPoint.location.symbolName) continue;
    const key = `${entryPoint.location.filePath}#${entryPoint.location.symbolName}`;
    const matches = byLocation.get(key);
    if (!matches || matches.length !== 1) continue;
    const functionId = matches[0].id;
    result.set(functionId, [
      ...(result.get(functionId) ?? []),
      entryPoint.kind,
    ]);
  }
  return result;
}

export function computeFunctionImportance(
  callableSignatures: CallableSignature[],
  behaviorEdges: BehaviorEdge[],
  behaviorNodes: BehaviorNode[],
  entryPoints: EntryPoint[]
): FunctionImportance[] {
  if (callableSignatures.length === 0) return [];

  const byId = new Map(callableSignatures.map((s) => [s.id, s]));
  const nodeById = new Map(behaviorNodes.map((n) => [n.id, n]));

  const { outgoing } = buildDirectedAdjacency(behaviorEdges);
  const callEdges = behaviorEdges.filter((e) => e.type === "CALL");
  const { outgoing: callOutgoing, incoming: callIncoming } =
    buildDirectedAdjacency(callEdges);

  const entryKindsByFunctionId = matchEntryPointsToFunctions(
    entryPoints,
    callableSignatures
  );
  const allNodeIds = [
    ...callableSignatures.map((s) => s.id),
    ...behaviorNodes.map((n) => n.id),
  ];
  const pageRank = simplePageRank(allNodeIds, outgoing, [
    ...entryKindsByFunctionId.keys(),
  ]);

  interface RawMetrics {
    signature: CallableSignature;
    reachabilityRaw: number;
    reachableFunctions: number;
    reachableModules: number;
    orchestrationRaw: number;
    distinctModulesCalled: number;
    dataInfluenceRaw: number;
    stateAuthorityRaw: number;
    stateWriteTargets: { stateId: EntityId; stateScope: StateScope }[];
    boundaryInfluenceRaw: number;
    directBoundaryTypes: BoundaryType[];
    structuralCentralityRaw: number;
    callFanIn: number;
    callFanOut: number;
  }

  const rawByFunction: RawMetrics[] = callableSignatures.map((signature) => {
    const id = signature.id;
    const reach = decayedReachability(id, outgoing);

    let reachableFunctions = 0;
    const reachableModules = new Set<string>();
    let reachableBoundaryWeight = 0;
    for (const [reachedId, weight] of reach.weightById) {
      const reachedFn = byId.get(reachedId);
      if (reachedFn) {
        reachableFunctions += 1;
        reachableModules.add(reachedFn.location.filePath);
        continue;
      }
      const node = nodeById.get(reachedId);
      if (node?.kind === "boundary") reachableBoundaryWeight += weight;
    }

    const outgoingIds = outgoing.get(id) ?? [];
    const outgoingEdges = behaviorEdges.filter((e) => e.source === id);

    const distinctModulesCalled = new Set(
      outgoingIds
        .map((targetId) => byId.get(targetId))
        .filter((fn): fn is CallableSignature => fn !== undefined)
        .map((fn) => fn.location.filePath)
        .filter((filePath) => filePath !== signature.location.filePath)
    ).size;
    const distinctEdgeTypesEmitted = new Set(outgoingEdges.map((e) => e.type))
      .size;
    const orchestrationRaw = distinctModulesCalled + distinctEdgeTypesEmitted;

    const dataFlowTouches = behaviorEdges.filter(
      (e) => e.type === "DATA_FLOW" && (e.source === id || e.target === id)
    ).length;
    const stateWriteOut = outgoingEdges.filter(
      (e) => e.type === "STATE_WRITE"
    ).length;
    const ioOut = outgoingEdges.filter((e) => e.type === "IO").length;
    const dataInfluenceRaw = dataFlowTouches + stateWriteOut + ioOut;

    const stateWriteTargets: { stateId: EntityId; stateScope: StateScope }[] =
      [];
    let stateAuthorityRaw = 0;
    for (const edge of outgoingEdges) {
      if (edge.type !== "STATE_WRITE" && edge.type !== "STATE_READ") continue;
      const stateNode = nodeById.get(edge.target);
      const stateScope: StateScope = stateNode?.stateScope ?? "local";
      const scopeMultiplier = stateScope === "shared" ? 1.6 : 1;
      const baseWeight = edge.type === "STATE_WRITE" ? 1 : 0.35;
      stateAuthorityRaw += baseWeight * scopeMultiplier;
      if (edge.type === "STATE_WRITE") {
        stateWriteTargets.push({ stateId: edge.target, stateScope });
      }
    }

    const directBoundaryTypes = [
      ...new Set(
        outgoingEdges
          .filter((e) => e.type === "IO")
          .map((e) => nodeById.get(e.target)?.boundaryType)
          .filter((t): t is BoundaryType => t !== undefined)
      ),
    ];
    const boundaryInfluenceRaw =
      outgoingEdges.filter((e) => e.type === "IO").length +
      reachableBoundaryWeight;

    const callFanIn = fanIn(id, callIncoming);
    const callFanOut = fanOut(id, callOutgoing);

    return {
      signature,
      reachabilityRaw: reach.totalWeight,
      reachableFunctions,
      reachableModules: reachableModules.size,
      orchestrationRaw,
      distinctModulesCalled,
      dataInfluenceRaw,
      stateAuthorityRaw,
      stateWriteTargets,
      boundaryInfluenceRaw,
      directBoundaryTypes,
      // Combined below, after fanIn/fanOut/crossModuleConnectivity/pageRank
      // are each normalized to [0,1] individually — they're different units
      // (small integer counts vs. a probability-like PageRank fraction) and
      // would otherwise drown each other out in a plain sum.
      structuralCentralityRaw: 0,
      callFanIn,
      callFanOut,
    };
  });

  // Structural centrality: normalize each sub-signal across the system
  // first, then sum — see the comment above.
  const fanInUnit = normalizeToUnit(rawByFunction.map((r) => r.callFanIn));
  const fanOutUnit = normalizeToUnit(rawByFunction.map((r) => r.callFanOut));
  const crossModuleUnit = normalizeToUnit(
    callableSignatures.map((s) => {
      const others = new Set([
        ...(callIncoming.get(s.id) ?? []),
        ...(callOutgoing.get(s.id) ?? []),
      ]);
      return [...others].filter(
        (id) => byId.get(id)?.location.filePath !== s.location.filePath
      ).length;
    })
  );
  const pageRankUnit = normalizeToUnit(
    callableSignatures.map((s) => pageRank.get(s.id) ?? 0)
  );
  rawByFunction.forEach((r, i) => {
    r.structuralCentralityRaw =
      fanInUnit[i] + fanOutUnit[i] + crossModuleUnit[i] + pageRankUnit[i];
  });

  const reachabilityScores = normalizeToScale(
    rawByFunction.map((r) => r.reachabilityRaw)
  );
  const orchestrationScores = normalizeToScale(
    rawByFunction.map((r) => r.orchestrationRaw)
  );
  const dataInfluenceScores = normalizeToScale(
    rawByFunction.map((r) => r.dataInfluenceRaw)
  );
  const stateAuthorityScores = normalizeToScale(
    rawByFunction.map((r) => r.stateAuthorityRaw)
  );
  const boundaryInfluenceScores = normalizeToScale(
    rawByFunction.map((r) => r.boundaryInfluenceRaw)
  );
  const structuralCentralityScores = normalizeToScale(
    rawByFunction.map((r) => r.structuralCentralityRaw)
  );

  return rawByFunction.map((raw, i) => {
    const vector: FunctionImportanceVector = {
      reachability: reachabilityScores[i],
      orchestration: orchestrationScores[i],
      dataInfluence: dataInfluenceScores[i],
      stateAuthority: stateAuthorityScores[i],
      boundaryInfluence: boundaryInfluenceScores[i],
      structuralCentrality: structuralCentralityScores[i],
    };
    const score = Math.round(
      IMPORTANCE_WEIGHTS.reachability * vector.reachability +
        IMPORTANCE_WEIGHTS.orchestration * vector.orchestration +
        IMPORTANCE_WEIGHTS.dataInfluence * vector.dataInfluence +
        IMPORTANCE_WEIGHTS.stateAuthority * vector.stateAuthority +
        IMPORTANCE_WEIGHTS.boundaryInfluence * vector.boundaryInfluence +
        IMPORTANCE_WEIGHTS.structuralCentrality * vector.structuralCentrality
    );

    const entryKinds = entryKindsByFunctionId.get(raw.signature.id) ?? [];
    const isEventTarget = behaviorEdges.some(
      (e) => e.type === "EVENT" && e.target === raw.signature.id
    );
    const isEventSource = behaviorEdges.some(
      (e) => e.type === "EVENT" && e.source === raw.signature.id
    );
    const hasDirectStateWrite = raw.stateWriteTargets.length > 0;
    const hasDirectBoundary = raw.directBoundaryTypes.length > 0;

    const roles: FunctionRole[] = [];
    if (entryKinds.length > 0) roles.push("ENTRY_POINT");
    if (vector.orchestration >= SIGNAL_THRESHOLD) roles.push("ORCHESTRATOR");
    if (vector.stateAuthority >= SIGNAL_THRESHOLD || hasDirectStateWrite) {
      roles.push("STATE_CONTROLLER");
    }
    if (vector.dataInfluence >= SIGNAL_THRESHOLD)
      roles.push("DATA_TRANSFORMER");
    if (vector.boundaryInfluence >= SIGNAL_THRESHOLD || hasDirectBoundary) {
      roles.push("BOUNDARY");
    }
    if (isEventTarget) roles.push("EVENT_HANDLER");
    if (isEventSource) roles.push("RENDERER");
    if (roles.length === 0 && raw.callFanIn > 0) roles.push("UTILITY");

    const reasons: ImportanceReason[] = [];
    if (vector.reachability >= SIGNAL_THRESHOLD) {
      reasons.push({
        type: "HIGH_REACHABILITY",
        reachableFunctions: raw.reachableFunctions,
        reachableModules: raw.reachableModules,
      });
    }
    if (
      vector.orchestration >= SIGNAL_THRESHOLD &&
      raw.distinctModulesCalled > 0
    ) {
      reasons.push({
        type: "ORCHESTRATES_MODULES",
        moduleCount: raw.distinctModulesCalled,
      });
    }
    for (const boundaryType of raw.directBoundaryTypes.slice(
      0,
      MAX_REASON_ITEMS_PER_KIND
    )) {
      reasons.push({ type: "CROSSES_BOUNDARY", boundaryType });
    }
    for (const target of raw.stateWriteTargets.slice(
      0,
      MAX_REASON_ITEMS_PER_KIND
    )) {
      reasons.push({
        type: "MUTATES_STATE",
        stateId: target.stateId,
        stateScope: target.stateScope,
      });
    }
    for (const kind of entryKinds.slice(0, MAX_REASON_ITEMS_PER_KIND)) {
      reasons.push({ type: "ENTRY_POINT", entryPointKind: kind });
    }
    if (vector.structuralCentrality >= SIGNAL_THRESHOLD) {
      reasons.push({
        type: "STRUCTURAL_HUB",
        fanIn: raw.callFanIn,
        fanOut: raw.callFanOut,
      });
    }

    return {
      functionId: raw.signature.id,
      score,
      vector,
      roles,
      reasons,
    } satisfies FunctionImportance;
  });
}
