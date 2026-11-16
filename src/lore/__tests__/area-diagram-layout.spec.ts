import {
  areaDiagramBounds,
  areaNeighborhood,
  DEFAULT_DIAGRAM_AREAS,
  deriveAreaDiagramLayout,
  deriveProductionAreaDiagramLayout,
  MAX_DIAGRAM_AREAS,
  smoothEdgePath,
  systemNeighborhoodAreas,
  type AreaDiagramEdge,
} from "../area-diagram-layout";
import type { AreaRelationship } from "../area-relationships";
import type { Relationship, StructuralArea } from "../model";

function area(overrides: Partial<StructuralArea> = {}): StructuralArea {
  return {
    id: "area:1",
    projectId: ".",
    name: "src",
    location: { filePath: "src" },
    rationale: "grouped by directory",
    importantLocations: [],
    entryPointIds: [],
    directDependencyIds: [],
    directDependentIds: [],
    testRelationshipIds: [],
    evidence: [],
    gaps: [],
    productionFilePaths: [],
    ...overrides,
  };
}

function edge(overrides: Partial<AreaRelationship> = {}): AreaRelationship {
  return {
    fromAreaId: "area:api",
    fromAreaName: "api",
    fromAreaLocation: { filePath: "src/api" },
    toAreaId: "area:worker",
    toAreaName: "worker",
    toAreaLocation: { filePath: "src/worker" },
    ...overrides,
  };
}

describe("deriveAreaDiagramLayout", () => {
  it("lays out a small graph with finite node positions and populated edge points", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const layout = deriveAreaDiagramLayout(
      [api, worker],
      [edge({ fromAreaId: "area:api", toAreaId: "area:worker" })]
    );

    expect(layout).not.toBeNull();
    expect(layout!.nodes).toHaveLength(2);
    for (const node of layout!.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
    expect(layout!.edges).toHaveLength(1);
    expect(layout!.edges[0].points.length).toBeGreaterThan(0);
    expect(layout!.width).toBeGreaterThan(0);
    expect(layout!.height).toBeGreaterThan(0);
  });

  it("drops edges that touch an area outside the given set", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const cli = area({ id: "area:cli", name: "cli" });
    const layout = deriveAreaDiagramLayout(
      [api, worker, cli],
      [
        edge({ fromAreaId: "area:api", toAreaId: "area:outside" }),
        edge({ fromAreaId: "area:cli", toAreaId: "area:worker" }),
      ]
    );

    expect(layout).not.toBeNull();
    expect(layout!.edges.map((e) => [e.fromId, e.toId])).toEqual([
      ["area:cli", "area:worker"],
    ]);
  });

  it("lists areas with no edges as unconnected instead of laying them out", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const examples = area({
      id: "area:examples",
      name: "examples",
      location: { filePath: "examples" },
    });
    const scripts = area({
      id: "area:scripts",
      name: "scripts",
      location: { filePath: "scripts" },
    });
    const layout = deriveAreaDiagramLayout(
      [examples, api, scripts, worker],
      [edge({ fromAreaId: "area:api", toAreaId: "area:worker" })]
    );

    expect(layout).not.toBeNull();
    expect(layout!.nodes.map((n) => n.id)).toEqual(["area:api", "area:worker"]);
    expect(layout!.unconnected).toEqual([
      {
        id: "area:examples",
        name: "examples",
        location: { filePath: "examples" },
      },
      {
        id: "area:scripts",
        name: "scripts",
        location: { filePath: "scripts" },
      },
    ]);
    // Two stacked ranks of one node each: unconnected areas no longer widen
    // the top rank alongside the real root.
    expect(layout!.width).toBe(200);
  });

  it("returns null when no area has an edge to another", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    expect(deriveAreaDiagramLayout([api, worker], [])).toBeNull();
    expect(
      deriveAreaDiagramLayout(
        [api, worker],
        [edge({ fromAreaId: "area:api", toAreaId: "area:outside" })]
      )
    ).toBeNull();
  });

  it("returns null for fewer than two areas", () => {
    expect(deriveAreaDiagramLayout([area()], [])).toBeNull();
    expect(deriveAreaDiagramLayout([], [])).toBeNull();
  });

  describe("above the diagram size ceiling", () => {
    // A hub importing MAX_DIAGRAM_AREAS + 3 leaves. Each area's own
    // relationship counts (what `compareMajorAreas` ranks by) match the
    // edges: the hub has the most, every leaf ties at one, so the name
    // tie-break decides which leaves are shown.
    const leafCount = MAX_DIAGRAM_AREAS + 3;
    const leaves = Array.from({ length: leafCount }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return area({
        id: `area:leaf-${n}`,
        name: `leaf-${n}`,
        directDependentIds: ["area:hub"],
      });
    });
    const hub = area({
      id: "area:hub",
      name: "hub",
      directDependencyIds: leaves.map((leaf) => leaf.id),
    });
    const standalone = area({ id: "area:standalone", name: "standalone" });
    const hubEdges = leaves.map((leaf) =>
      edge({ fromAreaId: "area:hub", toAreaId: leaf.id })
    );

    it("shows at most MAX_DIAGRAM_AREAS, in Major Areas order, ties by name", () => {
      // Input order is reversed so the result can't just be the first N given.
      const layout = deriveAreaDiagramLayout(
        [...leaves].reverse().concat(hub, standalone),
        hubEdges
      );

      expect(layout).not.toBeNull();
      const shown = layout!.nodes.map((n) => n.id).sort();
      expect(shown).toEqual(
        [
          "area:hub",
          ...leaves.slice(0, MAX_DIAGRAM_AREAS - 1).map((l) => l.id),
        ].sort()
      );
      expect(layout!.edges).toHaveLength(MAX_DIAGRAM_AREAS - 1);
      for (const e of layout!.edges) {
        expect(shown).toContain(e.fromId);
        expect(shown).toContain(e.toId);
      }
      expect(layout!.connectedAreaCount).toBe(leafCount + 1);
      expect(layout!.unconnected.map((a) => a.id)).toEqual(["area:standalone"]);
    });

    it("never exceeds MAX_DIAGRAM_AREAS, even with a larger limit", () => {
      const layout = deriveAreaDiagramLayout(
        [hub, ...leaves],
        hubEdges,
        undefined,
        MAX_DIAGRAM_AREAS + 10
      );
      expect(layout!.nodes).toHaveLength(MAX_DIAGRAM_AREAS);
    });

    it("shows DEFAULT_DIAGRAM_AREAS when given that limit, the same order's first areas", () => {
      const layout = deriveAreaDiagramLayout(
        [...leaves].reverse().concat(hub),
        hubEdges,
        undefined,
        DEFAULT_DIAGRAM_AREAS
      );

      expect(layout!.nodes.map((n) => n.id).sort()).toEqual(
        [
          "area:hub",
          ...leaves.slice(0, DEFAULT_DIAGRAM_AREAS - 1).map((l) => l.id),
        ].sort()
      );
      expect(layout!.edges).toHaveLength(DEFAULT_DIAGRAM_AREAS - 1);
      expect(layout!.connectedAreaCount).toBe(leafCount + 1);
    });

    it("ranks by each area's detected direct relationships, in or out", () => {
      // leaf-33 (last by name, so dropped on a tie) also imports `extra`,
      // so it now has two relationships and outranks every other leaf.
      const busyLeaf = {
        ...leaves[leafCount - 1],
        directDependencyIds: ["area:extra"],
      };
      const extra = area({
        id: "area:extra",
        name: "extra",
        directDependentIds: [busyLeaf.id],
      });
      const layout = deriveAreaDiagramLayout(
        [hub, ...leaves.slice(0, -1), busyLeaf, extra],
        [
          ...hubEdges,
          edge({ fromAreaId: "area:leaf-33", toAreaId: "area:extra" }),
        ],
        undefined,
        DEFAULT_DIAGRAM_AREAS
      );

      const shown = layout!.nodes.map((n) => n.id);
      expect(shown).toContain("area:leaf-33");
      expect(shown).not.toContain(leaves[DEFAULT_DIAGRAM_AREAS - 2].id);
      expect(shown).toHaveLength(DEFAULT_DIAGRAM_AREAS);
    });

    it("lists tests and tooling configuration after implementation areas", () => {
      // A test-support area with the most relationships still ranks last.
      const tests = area({
        id: "area:tests",
        name: "tests",
        responsibility: "Tests",
        directDependencyIds: leaves.map((leaf) => leaf.id),
      });
      const layout = deriveAreaDiagramLayout(
        [hub, tests, ...leaves],
        [
          ...hubEdges,
          ...leaves.map((leaf) =>
            edge({ fromAreaId: "area:tests", toAreaId: leaf.id })
          ),
        ],
        undefined,
        DEFAULT_DIAGRAM_AREAS
      );

      expect(layout!.nodes.map((n) => n.id)).not.toContain("area:tests");
    });

    it("always shows the pinned area, even ranked last", () => {
      for (const limit of [DEFAULT_DIAGRAM_AREAS, MAX_DIAGRAM_AREAS]) {
        const layout = deriveAreaDiagramLayout(
          [hub, ...leaves],
          hubEdges,
          "area:leaf-33",
          limit
        );

        const shown = layout!.nodes.map((n) => n.id);
        expect(shown).toContain("area:leaf-33");
        expect(shown).toContain("area:hub");
        expect(shown).not.toContain(leaves[limit - 2].id);
        expect(shown).toHaveLength(limit);
      }
    });
  });

  it("reports every connected area as shown below the ceiling", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const layout = deriveAreaDiagramLayout(
      [api, worker],
      [edge({ fromAreaId: "area:api", toAreaId: "area:worker" })]
    );
    expect(layout!.connectedAreaCount).toBe(2);
    expect(layout!.nodes).toHaveLength(2);
  });

  it("does not throw on a mutual (cyclic) dependency", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const layout = deriveAreaDiagramLayout(
      [api, worker],
      [
        edge({ fromAreaId: "area:api", toAreaId: "area:worker" }),
        edge({ fromAreaId: "area:worker", toAreaId: "area:api" }),
      ]
    );

    expect(layout).not.toBeNull();
    expect(layout!.edges).toHaveLength(2);
  });
});

function rel(fromId: string, toId: string): Relationship {
  return {
    id: `${fromId}->${toId}`,
    kind: "depends-on",
    fromId,
    toId,
    certainty: "detected",
    evidence: [],
  };
}

describe("deriveProductionAreaDiagramLayout", () => {
  it("drops an all-test area as a node entirely", () => {
    const api = area({
      id: "area:api",
      name: "api",
      productionFilePaths: ["src/api/index.ts"],
    });
    const tests = area({
      id: "area:tests",
      name: "tests",
      productionFilePaths: [],
    });
    const worker = area({
      id: "area:worker",
      name: "worker",
      productionFilePaths: ["src/worker/index.ts"],
    });

    const layout = deriveProductionAreaDiagramLayout(
      [api, tests, worker],
      [rel("src/api/index.ts", "src/worker/index.ts")]
    );

    expect(layout).not.toBeNull();
    expect(layout!.nodes.map((n) => n.id).sort()).toEqual([
      "area:api",
      "area:worker",
    ]);
  });

  it("returns null when fewer than two areas have production files", () => {
    const api = area({
      id: "area:api",
      productionFilePaths: ["src/api/index.ts"],
    });
    const tests = area({ id: "area:tests", productionFilePaths: [] });
    expect(deriveProductionAreaDiagramLayout([api, tests], [])).toBeNull();
  });
});

describe("systemNeighborhoodAreas", () => {
  const api = area({
    id: "area:api",
    name: "api",
    directDependencyIds: ["area:worker"],
    directDependentIds: ["area:cli"],
  });
  const worker = area({ id: "area:worker", name: "worker" });
  const cli = area({ id: "area:cli", name: "cli" });
  const docs = area({ id: "area:docs", name: "docs" });

  it("is the area plus everything it depends on or is depended on by", () => {
    expect(
      systemNeighborhoodAreas([api, worker, cli, docs], "area:api").map(
        (a) => a.id
      )
    ).toEqual(["area:api", "area:worker", "area:cli"]);
  });

  it("is empty for an id that isn't one of the areas", () => {
    expect(systemNeighborhoodAreas([api, worker], "area:missing")).toEqual([]);
  });

  it("scopes deriveProductionAreaDiagramLayout when pinned", () => {
    const withFiles = (a: StructuralArea) => ({
      ...a,
      productionFilePaths: [`src/${a.name}/index.ts`],
    });
    const layout = deriveProductionAreaDiagramLayout(
      [api, worker, cli, docs].map(withFiles),
      [
        rel("src/api/index.ts", "src/worker/index.ts"),
        rel("src/cli/index.ts", "src/api/index.ts"),
        rel("src/docs/index.ts", "src/worker/index.ts"),
      ],
      "area:api"
    );

    expect(layout!.nodes.map((n) => n.id).sort()).toEqual([
      "area:api",
      "area:cli",
      "area:worker",
    ]);
    expect(layout!.edges).toHaveLength(2);
  });
});

describe("areaNeighborhood", () => {
  // a -> b -> c, d -> b, b -> d, and c -> e (two hops from a).
  const edges: AreaDiagramEdge[] = [
    ["a", "b"],
    ["b", "c"],
    ["d", "b"],
    ["b", "d"],
    ["c", "e"],
    ["c", "d"],
  ].map(([fromId, toId]) => ({ fromId, toId, points: [] }));

  it("is the area, its direct neighbors in both directions, and the edges to them", () => {
    const { nodeIds, edgeIds } = areaNeighborhood(edges, "b");
    expect([...nodeIds].sort()).toEqual(["a", "b", "c", "d"]);
    expect([...edgeIds].sort()).toEqual(["a->b", "b->c", "b->d", "d->b"]);
  });

  it("leaves out edges between two neighbors and anything two hops away", () => {
    const { nodeIds, edgeIds } = areaNeighborhood(edges, "b");
    expect(edgeIds.has("c->d")).toBe(false);
    expect(nodeIds.has("e")).toBe(false);
    expect(edgeIds.has("c->e")).toBe(false);
  });

  it("is just the area itself when no drawn edge touches it", () => {
    const { nodeIds, edgeIds } = areaNeighborhood(edges, "z");
    expect([...nodeIds]).toEqual(["z"]);
    expect(edgeIds.size).toBe(0);
  });
});

describe("smoothEdgePath", () => {
  it("draws a straight line between two points", () => {
    expect(
      smoothEdgePath([
        { x: 0, y: 0 },
        { x: 10, y: 20 },
      ])
    ).toBe("M 0 0 L 10 20");
  });

  it("bends at each interior point, joining at midpoints, ending on the last point", () => {
    expect(
      smoothEdgePath([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 10 },
        { x: 30, y: 30 },
      ])
    ).toBe("M 0 0 Q 10 10 15 10 Q 20 10 30 30");
  });

  it("starts and ends on dagre's routed end points for a real layout", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const layout = deriveAreaDiagramLayout(
      [api, worker],
      [edge({ fromAreaId: "area:api", toAreaId: "area:worker" })]
    );
    const { points } = layout!.edges[0];
    const path = smoothEdgePath(points);
    const first = points[0];
    const last = points.at(-1)!;
    expect(path.startsWith(`M ${first.x} ${first.y}`)).toBe(true);
    expect(path.endsWith(`${last.x} ${last.y}`)).toBe(true);
  });

  it("is empty for no points", () => {
    expect(smoothEdgePath([])).toBe("");
  });
});

describe("areaDiagramBounds", () => {
  it("is the box around every drawn node", () => {
    const node = (x: number, y: number) => ({
      id: `${x},${y}`,
      name: "n",
      location: { filePath: "n" },
      x,
      y,
      width: 200,
      height: 64,
    });
    expect(
      areaDiagramBounds({ nodes: [node(40, 10), node(-20, 120), node(300, 0)] })
    ).toEqual({ x: -20, y: 0, width: 520, height: 184 });
  });

  it("matches a real layout's nodes", () => {
    const api = area({ id: "area:api", name: "api" });
    const worker = area({ id: "area:worker", name: "worker" });
    const layout = deriveAreaDiagramLayout(
      [api, worker],
      [edge({ fromAreaId: "area:api", toAreaId: "area:worker" })]
    )!;
    const bounds = areaDiagramBounds(layout);
    for (const n of layout.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(bounds.x);
      expect(n.y).toBeGreaterThanOrEqual(bounds.y);
      expect(n.x + n.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(n.y + n.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
    expect(bounds.width).toBe(200);
  });

  it("is empty for no nodes", () => {
    expect(areaDiagramBounds({ nodes: [] })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});
