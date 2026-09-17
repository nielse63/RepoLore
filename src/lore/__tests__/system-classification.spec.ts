import { classifySystem } from "../system-classification";
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

describe("classifySystem", () => {
  it("classifies an area with no responsibility as an implementation area", () => {
    expect(classifySystem(area())).toBe("Implementation area");
  });

  it('classifies "Tests" as tests / test support', () => {
    expect(classifySystem(area({ responsibility: "Tests" }))).toBe(
      "Tests / test support"
    );
  });

  it('classifies "Test fixtures/support data" as tests / test support', () => {
    expect(
      classifySystem(area({ responsibility: "Test fixtures/support data" }))
    ).toBe("Tests / test support");
  });

  it('classifies "Build/tooling configuration" as build/tooling configuration', () => {
    expect(
      classifySystem(area({ responsibility: "Build/tooling configuration" }))
    ).toBe("Build/tooling configuration");
  });

  it("falls back to implementation area for an unrecognized responsibility", () => {
    expect(
      classifySystem(
        area({ responsibility: "Presentational React components" })
      )
    ).toBe("Implementation area");
  });
});
