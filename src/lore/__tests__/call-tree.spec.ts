import type {
  CallableSignature,
  CallEdge,
  EntryPoint,
  PublicContract,
} from "../model";
import { buildCalleesIndex, deriveCallTreeRootIds } from "../call-tree";

function signature(
  id: string,
  name: string,
  filePath = "src/math.ts"
): CallableSignature {
  return {
    id,
    name,
    kind: "function",
    location: { filePath, symbolName: name },
    parameters: [],
    returnCertainty: "unknown",
    evidence: [],
  };
}

function edge(id: string, callerId: string, calleeId: string): CallEdge {
  return {
    id,
    callerId,
    calleeId,
    callSiteLocation: { filePath: "src/math.ts" },
    certainty: "detected",
    evidence: [],
  };
}

function exportContract(
  name: string,
  declaredFilePath: string
): PublicContract {
  return {
    id: `public-${name}`,
    areaId: "src/index.ts",
    name,
    kind: "export",
    location: { filePath: "src/index.ts", symbolName: name },
    evidence: [
      {
        kind: "export-declaration",
        certainty: "detected",
        location: { filePath: declaredFilePath, symbolName: name },
        description: `'${name}' is exported.`,
      },
    ],
  };
}

describe("deriveCallTreeRootIds", () => {
  it("resolves PublicContract exports (re-export shape) to their declaring CallableSignature", () => {
    const add = signature("add", "add");
    const multiply = signature("multiply", "multiply");
    const divide = signature("divide", "divide");
    const roundTo = signature("roundTo", "roundTo", "src/internal/round.ts");
    const signatures = [add, multiply, divide, roundTo];
    const edges = [edge("e1", "divide", "roundTo")];
    const contracts = [
      exportContract("add", "src/math.ts"),
      exportContract("multiply", "src/math.ts"),
      exportContract("divide", "src/math.ts"),
    ];

    const roots = deriveCallTreeRootIds(signatures, edges, contracts, []);

    expect(roots.sort()).toEqual(["add", "divide", "multiply"]);
  });

  it("unions PublicContract exports with EntryPoint matches", () => {
    const exported = signature("exported", "exported");
    const handler = signature("handler", "handler", "src/api/route.ts");
    const signatures = [exported, handler];
    const contracts = [exportContract("exported", "src/math.ts")];
    const entryPoints: EntryPoint[] = [
      {
        id: "ep-1",
        kind: "route",
        location: { filePath: "src/api/route.ts", symbolName: "handler" },
        certainty: "detected",
        evidence: [],
      },
    ];

    const roots = deriveCallTreeRootIds(signatures, [], contracts, entryPoints);

    expect(roots.sort()).toEqual(["exported", "handler"]);
  });

  it("falls back to fan-in-0 functions when no exports or entry points resolve", () => {
    const top = signature("top", "top");
    const helper = signature("helper", "helper");
    const signatures = [top, helper];
    const edges = [edge("e1", "top", "helper")];

    const roots = deriveCallTreeRootIds(signatures, edges, [], []);

    expect(roots).toEqual(["top"]);
  });

  it("falls back to every function when even fan-in-0 is empty (fully cyclic)", () => {
    const a = signature("a", "a");
    const b = signature("b", "b");
    const signatures = [a, b];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "a")];

    const roots = deriveCallTreeRootIds(signatures, edges, [], []);

    expect(roots.sort()).toEqual(["a", "b"]);
  });

  it("returns an empty array for no callables", () => {
    expect(deriveCallTreeRootIds([], [], [], [])).toEqual([]);
  });
});

describe("buildCalleesIndex", () => {
  it("dedupes multiple call sites to the same callee", () => {
    const edges = [
      edge("e1", "a", "b"),
      edge("e2", "a", "b"),
      edge("e3", "a", "c"),
    ];

    const index = buildCalleesIndex(edges);

    expect(index.get("a")?.sort()).toEqual(["b", "c"]);
  });

  it("returns an empty map for no edges", () => {
    expect(buildCalleesIndex([]).size).toBe(0);
  });
});
