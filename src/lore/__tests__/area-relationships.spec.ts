import { deriveAreaRelationships } from "../area-relationships";
import type { StructuralArea } from "../model";

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
