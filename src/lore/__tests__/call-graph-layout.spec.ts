import type { CallableSignature, CallEdge } from "../model";
import {
  deriveCallGraphLayout,
  MAX_CALL_GRAPH_NODES,
} from "../call-graph-layout";

function signature(id: string, name: string): CallableSignature {
  return {
    id,
    name,
    kind: "function",
    location: { filePath: "src/index.ts", symbolName: name },
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
    callSiteLocation: { filePath: "src/index.ts" },
    certainty: "detected",
    evidence: [],
  };
}

describe("deriveCallGraphLayout", () => {
  it("returns null for an unknown focus id", () => {
    expect(deriveCallGraphLayout("missing", [], [])).toBeNull();
  });

  it("includes the full transitive caller/callee chain when under the cap", () => {
    const signatures = [
      signature("a", "a"),
      signature("b", "b"),
      signature("c", "c"),
    ];
    const edges = [edge("e1", "a", "b"), edge("e2", "b", "c")];

    const layout = deriveCallGraphLayout("b", signatures, edges);

    expect(layout).not.toBeNull();
    expect(layout!.truncated).toBe(false);
    expect(layout!.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(layout!.nodes.find((n) => n.id === "b")!.isFocus).toBe(true);
    expect(layout!.edges).toHaveLength(2);
  });

  it("falls back to direct callers/callees only when the transitive chain exceeds the cap", () => {
    // A long chain: 0 -> 1 -> 2 -> ... -> N, focused in the middle, whose
    // full transitive reach (both directions) exceeds MAX_CALL_GRAPH_NODES.
    const chainLength = MAX_CALL_GRAPH_NODES + 10;
    const signatures = Array.from({ length: chainLength }, (_, i) =>
      signature(String(i), `fn${i}`)
    );
    const edges = Array.from({ length: chainLength - 1 }, (_, i) =>
      edge(`e${i}`, String(i), String(i + 1))
    );
    const focusId = String(Math.floor(chainLength / 2));

    const layout = deriveCallGraphLayout(focusId, signatures, edges);

    expect(layout).not.toBeNull();
    expect(layout!.truncated).toBe(true);
    expect(layout!.nodes.length).toBeLessThanOrEqual(MAX_CALL_GRAPH_NODES);
    const ids = layout!.nodes.map((n) => n.id);
    expect(ids).toContain(focusId);
    expect(ids).toContain(String(Number(focusId) - 1));
    expect(ids).toContain(String(Number(focusId) + 1));
  });
});
