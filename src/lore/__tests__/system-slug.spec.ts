import { assignSystemSlugs, findAreaBySlug } from "../system-slug";
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

describe("assignSystemSlugs", () => {
  it("kebab-cases an area name", () => {
    const areas = [area({ name: "src/components" })];
    expect(assignSystemSlugs(areas)).toEqual([
      { area: areas[0], slug: "src-components" },
    ]);
  });

  it("breaks collisions with a numeric suffix in array order", () => {
    const first = area({ id: "area:1", name: "api" });
    const second = area({ id: "area:2", name: "api" });
    expect(assignSystemSlugs([first, second])).toEqual([
      { area: first, slug: "api" },
      { area: second, slug: "api-2" },
    ]);
  });

  it("falls back to a placeholder slug for a name with no alphanumeric characters", () => {
    expect(assignSystemSlugs([area({ name: "." })])[0].slug).toBe("area");
  });
});

describe("findAreaBySlug", () => {
  it("resolves a slug back to its area", () => {
    const areas = [area({ id: "area:1", name: "worker" })];
    expect(findAreaBySlug(areas, "worker")).toBe(areas[0]);
  });

  it("returns undefined for an unknown slug", () => {
    expect(findAreaBySlug([area()], "missing")).toBeUndefined();
  });
});
