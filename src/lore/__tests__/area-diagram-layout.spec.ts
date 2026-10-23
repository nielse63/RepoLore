import {
  deriveAreaDiagramLayout,
  deriveProductionAreaDiagramLayout,
  MAX_DIAGRAM_AREAS,
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
    // A hub importing MAX_DIAGRAM_AREAS + 3 leaves: the hub has the most
    // detected relationships, and every leaf ties at one, so the name
    // tie-break decides which leaves are shown.
    const leafCount = MAX_DIAGRAM_AREAS + 3;
    const hub = area({ id: "area:hub", name: "hub" });
    const leaves = Array.from({ length: leafCount }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return area({ id: `area:leaf-${n}`, name: `leaf-${n}` });
    });
    const standalone = area({ id: "area:standalone", name: "standalone" });
    const hubEdges = leaves.map((leaf) =>
      edge({ fromAreaId: "area:hub", toAreaId: leaf.id })
    );

    it("shows only the areas with the most detected relationships, ties by name", () => {
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

    it("ranks relationships by distinct neighbor area, in or out", () => {
      // leaf-33 (last by name, so dropped on a tie) gets a second neighbor;
      // a reverse edge back to the hub must not count as a second one.
      const extra = area({ id: "area:extra", name: "extra" });
      const layout = deriveAreaDiagramLayout(
        [hub, ...leaves, extra],
        [
          ...hubEdges,
          edge({ fromAreaId: "area:leaf-33", toAreaId: "area:extra" }),
          edge({ fromAreaId: "area:leaf-01", toAreaId: "area:hub" }),
        ]
      );

      const shown = layout!.nodes.map((n) => n.id);
      expect(shown).toContain("area:leaf-33");
      expect(shown).not.toContain("area:leaf-29");
      expect(shown).toHaveLength(MAX_DIAGRAM_AREAS);
    });

    it("always shows the pinned area, even with fewer relationships", () => {
      const layout = deriveAreaDiagramLayout(
        [hub, ...leaves],
        hubEdges,
        "area:leaf-33"
      );

      const shown = layout!.nodes.map((n) => n.id);
      expect(shown).toContain("area:leaf-33");
      expect(shown).toContain("area:hub");
      expect(shown).not.toContain("area:leaf-29");
      expect(shown).toHaveLength(MAX_DIAGRAM_AREAS);
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
