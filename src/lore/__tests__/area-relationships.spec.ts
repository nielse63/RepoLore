import {
  deriveAreaRelationships,
  deriveProductionAreaRelationships,
} from "../area-relationships";
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

describe("deriveAreaRelationships", () => {
  it("resolves directDependencyIds into named, located edges", () => {
    const api = area({
      id: "area:api",
      name: "api",
      location: { filePath: "src/api" },
      directDependencyIds: ["area:worker"],
    });
    const worker = area({
      id: "area:worker",
      name: "worker",
      location: { filePath: "src/worker" },
    });

    expect(deriveAreaRelationships([api, worker])).toEqual([
      {
        fromAreaId: "area:api",
        fromAreaName: "api",
        fromAreaLocation: { filePath: "src/api" },
        toAreaId: "area:worker",
        toAreaName: "worker",
        toAreaLocation: { filePath: "src/worker" },
      },
    ]);
  });

  it("skips dependency ids that don't resolve to a known area", () => {
    const api = area({ id: "area:api", directDependencyIds: ["area:missing"] });
    expect(deriveAreaRelationships([api])).toEqual([]);
  });

  it("de-duplicates repeated edges between the same pair of areas", () => {
    const api = area({
      id: "area:api",
      directDependencyIds: ["area:worker", "area:worker"],
    });
    const worker = area({ id: "area:worker" });
    expect(deriveAreaRelationships([api, worker])).toHaveLength(1);
  });

  it("returns nothing when no area has any dependencies", () => {
    expect(deriveAreaRelationships([area()])).toEqual([]);
  });

  it("returns nothing for an empty area list", () => {
    expect(deriveAreaRelationships([])).toEqual([]);
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

describe("deriveProductionAreaRelationships", () => {
  it("resolves a file-level relationship into an edge between the areas owning each production file", () => {
    const api = area({
      id: "area:api",
      name: "api",
      location: { filePath: "src/api" },
      productionFilePaths: ["src/api/index.ts"],
    });
    const worker = area({
      id: "area:worker",
      name: "worker",
      location: { filePath: "src/worker" },
      productionFilePaths: ["src/worker/index.ts"],
    });

    expect(
      deriveProductionAreaRelationships(
        [api, worker],
        [rel("src/api/index.ts", "src/worker/index.ts")]
      )
    ).toEqual([
      {
        fromAreaId: "area:api",
        fromAreaName: "api",
        fromAreaLocation: { filePath: "src/api" },
        toAreaId: "area:worker",
        toAreaName: "worker",
        toAreaLocation: { filePath: "src/worker" },
      },
    ]);
  });

  it("excludes a relationship whose source is a test file, even in a mixed production/test area", () => {
    const button = area({
      id: "area:button",
      name: "button",
      productionFilePaths: ["src/components/Button.tsx"],
      // "src/components/Button/__tests__/button.test.tsx" is deliberately
      // absent from productionFilePaths, as derive-views would leave it.
    });
    const utils = area({
      id: "area:utils",
      name: "utils",
      productionFilePaths: ["src/utils/helpers.ts"],
    });

    expect(
      deriveProductionAreaRelationships(
        [button, utils],
        [
          rel(
            "src/components/Button/__tests__/button.test.tsx",
            "src/utils/helpers.ts"
          ),
        ]
      )
    ).toEqual([]);
  });

  it("excludes a same-area relationship", () => {
    const api = area({
      id: "area:api",
      productionFilePaths: ["src/api/a.ts", "src/api/b.ts"],
    });
    expect(
      deriveProductionAreaRelationships(
        [api],
        [rel("src/api/a.ts", "src/api/b.ts")]
      )
    ).toEqual([]);
  });

  it("de-duplicates multiple file-level relationships resolving to the same area pair", () => {
    const api = area({
      id: "area:api",
      productionFilePaths: ["src/api/a.ts", "src/api/b.ts"],
    });
    const worker = area({
      id: "area:worker",
      productionFilePaths: ["src/worker/index.ts"],
    });
    expect(
      deriveProductionAreaRelationships(
        [api, worker],
        [
          rel("src/api/a.ts", "src/worker/index.ts"),
          rel("src/api/b.ts", "src/worker/index.ts"),
        ]
      )
    ).toHaveLength(1);
  });

  it("returns nothing when relationships reference files outside any area's productionFilePaths", () => {
    const api = area({ id: "area:api", productionFilePaths: [] });
    expect(
      deriveProductionAreaRelationships(
        [api],
        [rel("src/api/a.ts", "src/api/b.ts")]
      )
    ).toEqual([]);
  });
});
