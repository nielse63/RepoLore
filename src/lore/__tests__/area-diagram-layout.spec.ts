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
    const layout = deriveAreaDiagramLayout(
      [api, worker],
      [edge({ fromAreaId: "area:api", toAreaId: "area:outside" })]
    );

    expect(layout).not.toBeNull();
    expect(layout!.edges).toEqual([]);
  });

  it("returns null for fewer than two areas", () => {
    expect(deriveAreaDiagramLayout([area()], [])).toBeNull();
    expect(deriveAreaDiagramLayout([], [])).toBeNull();
  });

  it("returns null above the diagram size ceiling", () => {
    const areas = Array.from({ length: MAX_DIAGRAM_AREAS + 1 }, (_, i) =>
      area({ id: `area:${i}`, name: `area-${i}` })
    );
    expect(deriveAreaDiagramLayout(areas, [])).toBeNull();
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
