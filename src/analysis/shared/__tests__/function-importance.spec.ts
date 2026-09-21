import type {
  BehaviorEdge,
  BehaviorNode,
  CallableSignature,
  EntryPoint,
} from "@/lore/model";
import { computeFunctionImportance } from "../function-importance";

function signature(
  id: string,
  filePath: string,
  symbolName?: string
): CallableSignature {
  return {
    id,
    name: symbolName ?? id,
    kind: "function",
    location: { filePath, symbolName },
    parameters: [],
    returnCertainty: "unknown",
    evidence: [],
  };
}

function edge(
  id: string,
  source: string,
  target: string,
  type: BehaviorEdge["type"]
): BehaviorEdge {
  return { id, source, target, type, certainty: "detected", evidence: [] };
}

describe("computeFunctionImportance", () => {
  it("returns an empty array when there are no callables", () => {
    expect(computeFunctionImportance([], [], [], [])).toEqual([]);
  });

  it("produces one entry per callable, with a bounded vector and an integer score", () => {
    const a = signature("fn-a", "a.ts");
    const b = signature("fn-b", "b.ts");
    const result = computeFunctionImportance(
      [a, b],
      [edge("e1", "fn-a", "fn-b", "CALL")],
      [],
      []
    );

    expect(result).toHaveLength(2);
    for (const importance of result) {
      expect(Number.isInteger(importance.score)).toBe(true);
      for (const value of Object.values(importance.vector)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it("assigns ENTRY_POINT only to the function matching an entry point's file and symbol", () => {
    const handler = signature("fn-handler", "a.ts", "handler");
    const other = signature("fn-other", "b.ts", "other");
    const entryPoint: EntryPoint = {
      id: "ep-1",
      kind: "http-handler",
      location: { filePath: "a.ts", symbolName: "handler" },
      certainty: "detected",
      evidence: [],
    };

    const result = computeFunctionImportance(
      [handler, other],
      [],
      [],
      [entryPoint]
    );

    const handlerImportance = result.find(
      (r) => r.functionId === "fn-handler"
    )!;
    const otherImportance = result.find((r) => r.functionId === "fn-other")!;
    expect(handlerImportance.roles).toContain("ENTRY_POINT");
    expect(handlerImportance.reasons).toContainEqual(
      expect.objectContaining({
        type: "ENTRY_POINT",
        entryPointKind: "http-handler",
      })
    );
    expect(otherImportance.roles).not.toContain("ENTRY_POINT");
  });

  it("skips an entry point with no symbolName rather than guessing a match", () => {
    const a = signature("fn-a", "a.ts");
    const entryPoint: EntryPoint = {
      id: "ep-1",
      kind: "route",
      location: { filePath: "a.ts" },
      certainty: "inferred",
      evidence: [],
    };

    const result = computeFunctionImportance([a], [], [], [entryPoint]);
    expect(result[0].roles).not.toContain("ENTRY_POINT");
  });

  it("assigns STATE_CONTROLLER and a MUTATES_STATE reason for a direct write to shared state", () => {
    const a = signature("fn-a", "a.ts");
    const b = signature("fn-b", "b.ts");
    const stateNode: BehaviorNode = {
      id: "state-1",
      kind: "state",
      name: "count",
      stateScope: "shared",
    };

    const result = computeFunctionImportance(
      [a, b],
      [
        edge("e1", "fn-a", "fn-b", "CALL"),
        edge("e2", "fn-b", "state-1", "STATE_WRITE"),
      ],
      [stateNode],
      []
    );

    const bImportance = result.find((r) => r.functionId === "fn-b")!;
    expect(bImportance.roles).toContain("STATE_CONTROLLER");
    expect(bImportance.reasons).toContainEqual(
      expect.objectContaining({
        type: "MUTATES_STATE",
        stateId: "state-1",
        stateScope: "shared",
      })
    );

    const aImportance = result.find((r) => r.functionId === "fn-a")!;
    expect(aImportance.roles).not.toContain("STATE_CONTROLLER");
  });

  it("assigns BOUNDARY and a CROSSES_BOUNDARY reason for a direct IO edge", () => {
    const a = signature("fn-a", "a.ts");
    const boundaryNode: BehaviorNode = {
      id: "boundary-1",
      kind: "boundary",
      name: "fetch",
      boundaryType: "http",
    };

    const result = computeFunctionImportance(
      [a],
      [edge("e1", "fn-a", "boundary-1", "IO")],
      [boundaryNode],
      []
    );

    expect(result[0].roles).toContain("BOUNDARY");
    expect(result[0].reasons).toContainEqual(
      expect.objectContaining({
        type: "CROSSES_BOUNDARY",
        boundaryType: "http",
      })
    );
  });

  it("falls back to UTILITY for a called function with no other signal", () => {
    const caller = signature("fn-caller", "a.ts");
    const callee = signature("fn-callee", "b.ts");

    const result = computeFunctionImportance(
      [caller, callee],
      [edge("e1", "fn-caller", "fn-callee", "CALL")],
      [],
      []
    );

    const calleeImportance = result.find((r) => r.functionId === "fn-callee")!;
    expect(calleeImportance.roles).toEqual(["UTILITY"]);
  });

  it("assigns no roles to an isolated function with no callers, callees, or signals", () => {
    const isolated = signature("fn-isolated", "a.ts");
    const result = computeFunctionImportance([isolated], [], [], []);
    expect(result[0].roles).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const a = signature("fn-a", "a.ts");
    const b = signature("fn-b", "b.ts");
    const edges = [edge("e1", "fn-a", "fn-b", "CALL")];

    const first = computeFunctionImportance([a, b], edges, [], []);
    const second = computeFunctionImportance([a, b], edges, [], []);

    expect(second).toEqual(first);
  });
});
