import {
  buildDirectedAdjacency,
  decayedReachability,
  fanIn,
  fanOut,
  simplePageRank,
  type DirectedEdgeLike,
} from "../behavior-graph";

describe("buildDirectedAdjacency", () => {
  it("indexes edges both outgoing (source -> targets) and incoming (target -> sources)", () => {
    const edges: DirectedEdgeLike[] = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "c" },
    ];

    const { outgoing, incoming } = buildDirectedAdjacency(edges);

    expect(outgoing.get("a")).toEqual(["b", "c"]);
    expect(outgoing.get("b")).toEqual(["c"]);
    expect(outgoing.get("c")).toBeUndefined();
    expect(incoming.get("c")).toEqual(["a", "b"]);
    expect(incoming.get("b")).toEqual(["a"]);
    expect(incoming.get("a")).toBeUndefined();
  });

  it("returns empty maps for no edges", () => {
    const { outgoing, incoming } = buildDirectedAdjacency([]);
    expect(outgoing.size).toBe(0);
    expect(incoming.size).toBe(0);
  });
});

describe("decayedReachability", () => {
  it("weights each reached node by 0.7^(distance-1) and excludes the origin", () => {
    const { outgoing } = buildDirectedAdjacency([
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ]);

    const { weightById, totalWeight } = decayedReachability("a", outgoing);

    expect(weightById.has("a")).toBe(false);
    expect(weightById.get("b")).toBeCloseTo(1);
    expect(weightById.get("c")).toBeCloseTo(0.7);
    expect(totalWeight).toBeCloseTo(1.7);
  });

  it("does not revisit or double-count a node reached through a cycle", () => {
    const { outgoing } = buildDirectedAdjacency([
      { source: "a", target: "b" },
      { source: "b", target: "a" },
    ]);

    const { weightById, totalWeight } = decayedReachability("a", outgoing);

    expect([...weightById.keys()]).toEqual(["b"]);
    expect(totalWeight).toBeCloseTo(1);
  });

  it("stops traversal once a hop's decay weight drops below the minimum threshold", () => {
    const edges: DirectedEdgeLike[] = [];
    const chainLength = 10;
    for (let i = 1; i < chainLength; i++) {
      edges.push({ source: `n${i}`, target: `n${i + 1}` });
    }
    const { outgoing } = buildDirectedAdjacency(edges);

    const { weightById } = decayedReachability("n1", outgoing);

    // 0.7^7 ~= 0.082 (>= 0.06, included), 0.7^8 ~= 0.058 (< 0.06, excluded):
    // n2..n9 are reached (8 nodes), n10 is one hop past the cutoff.
    expect(weightById.has("n9")).toBe(true);
    expect(weightById.has("n10")).toBe(false);
    expect(weightById.size).toBe(8);
  });

  it("returns an empty result for a node with no outgoing edges", () => {
    const { outgoing } = buildDirectedAdjacency([{ source: "a", target: "b" }]);
    const { weightById, totalWeight } = decayedReachability("b", outgoing);
    expect(weightById.size).toBe(0);
    expect(totalWeight).toBe(0);
  });
});

describe("fanIn / fanOut", () => {
  const { outgoing, incoming } = buildDirectedAdjacency([
    { source: "a", target: "b" },
    { source: "c", target: "b" },
    { source: "b", target: "d" },
  ]);

  it("counts incoming edges", () => {
    expect(fanIn("b", incoming)).toBe(2);
    expect(fanIn("a", incoming)).toBe(0);
  });

  it("counts outgoing edges", () => {
    expect(fanOut("b", outgoing)).toBe(1);
    expect(fanOut("d", outgoing)).toBe(0);
  });
});

describe("simplePageRank", () => {
  it("returns an empty map for no nodes", () => {
    expect(simplePageRank([], new Map())).toEqual(new Map());
  });

  it("splits rank evenly between two mutually-dangling, unconnected nodes", () => {
    const ranks = simplePageRank(["a", "b"], new Map());
    expect(ranks.get("a")).toBeCloseTo(0.5);
    expect(ranks.get("b")).toBeCloseTo(0.5);
  });

  it("accumulates more rank on a node that receives an edge than one that only sends one", () => {
    const { outgoing } = buildDirectedAdjacency([{ source: "a", target: "b" }]);
    const ranks = simplePageRank(["a", "b"], outgoing);

    expect(ranks.get("b")!).toBeGreaterThan(ranks.get("a")!);
    expect((ranks.get("a") ?? 0) + (ranks.get("b") ?? 0)).toBeCloseTo(1);
  });

  it("concentrates more rank on a seeded node than an equally-connected unseeded one", () => {
    const { outgoing } = buildDirectedAdjacency([
      { source: "hub", target: "a" },
      { source: "hub", target: "b" },
    ]);

    const unseeded = simplePageRank(["hub", "a", "b"], outgoing);
    const seeded = simplePageRank(["hub", "a", "b"], outgoing, ["a"]);

    expect(seeded.get("a")!).toBeGreaterThan(unseeded.get("a")!);
  });

  it("ignores seed ids that aren't in the node set", () => {
    const ranks = simplePageRank(["a", "b"], new Map(), ["not-a-node"]);
    expect(ranks.get("a")).toBeCloseTo(0.5);
    expect(ranks.get("b")).toBeCloseTo(0.5);
  });
});
