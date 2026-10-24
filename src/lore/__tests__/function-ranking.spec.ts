import { rankByImportance } from "../function-ranking";
import type { CallableSignature, FunctionImportance } from "../model";

function signature(id: string, name: string): CallableSignature {
  return {
    id,
    name,
    kind: "function",
    location: { filePath: "src/math.ts", symbolName: name },
    parameters: [],
    returnCertainty: "unknown",
    evidence: [],
  };
}

function importance(functionId: string, score: number): FunctionImportance {
  return {
    functionId,
    score,
    vector: {
      reachability: 0,
      orchestration: 0,
      dataInfluence: 0,
      stateAuthority: 0,
      boundaryInfluence: 0,
      structuralCentrality: 0,
    },
    roles: [],
    reasons: [],
  };
}

function byId(entries: FunctionImportance[]) {
  return new Map(entries.map((fi) => [fi.functionId, fi]));
}

describe("rankByImportance", () => {
  it("orders by importance score, highest first, regardless of name or input order", () => {
    // The reported shape: an alphabetically-first, persisted-first
    // zero-importance callback ahead of the real orchestrators.
    const signatures = [
      signature("a", "entryFilter"),
      signature("b", "extractPythonProject"),
      signature("c", "_read"),
      signature("d", "extractJsTsProject"),
    ];
    const ranked = rankByImportance(
      signatures,
      byId([
        importance("a", 0),
        importance("b", 41),
        importance("c", 3),
        importance("d", 58),
      ])
    );
    expect(ranked.map((s) => s.name)).toEqual([
      "extractJsTsProject",
      "extractPythonProject",
      "_read",
      "entryFilter",
    ]);
  });

  it("breaks score ties by name", () => {
    const ranked = rankByImportance(
      [signature("a", "zeta"), signature("b", "alpha"), signature("c", "mu")],
      byId([importance("a", 10), importance("b", 10), importance("c", 10)])
    );
    expect(ranked.map((s) => s.name)).toEqual(["alpha", "mu", "zeta"]);
  });

  it("ranks a function with no importance entry as score 0", () => {
    const ranked = rankByImportance(
      [
        signature("a", "unscored"),
        signature("b", "low"),
        signature("c", "aaa"),
      ],
      byId([importance("b", 1), importance("c", 0)])
    );
    expect(ranked.map((s) => s.name)).toEqual(["low", "aaa", "unscored"]);
  });

  it("returns a new array and leaves the input order untouched", () => {
    const signatures = [signature("a", "low"), signature("b", "high")];
    const ranked = rankByImportance(
      signatures,
      byId([importance("a", 1), importance("b", 2)])
    );
    expect(ranked).not.toBe(signatures);
    expect(signatures.map((s) => s.name)).toEqual(["low", "high"]);
    expect(rankByImportance([], new Map())).toEqual([]);
  });
});
