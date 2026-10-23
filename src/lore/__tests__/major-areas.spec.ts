import {
  compareMajorAreas,
  majorAreasOf,
  majorAreasOrderNote,
  rankMajorAreas,
} from "../major-areas";
import type { StructuralArea } from "../model";

const area = (name: string) => ({ name }) as StructuralArea;

const ranked = (
  name: string,
  {
    dependencies = 0,
    dependents = 0,
    entryPoints = 0,
    responsibility,
  }: {
    dependencies?: number;
    dependents?: number;
    entryPoints?: number;
    responsibility?: string;
  } = {}
) =>
  ({
    name,
    responsibility,
    directDependencyIds: Array.from(
      { length: dependencies },
      (_, i) => `d${i}`
    ),
    directDependentIds: Array.from({ length: dependents }, (_, i) => `r${i}`),
    entryPointIds: Array.from({ length: entryPoints }, (_, i) => `e${i}`),
  }) as StructuralArea;

const names = (areas: StructuralArea[]) => areas.map((a) => a.name);

describe("majorAreasOf", () => {
  it("drops only the root directory area", () => {
    expect(
      majorAreasOf([area("src"), area("."), area("lib")]).map((a) => a.name)
    ).toEqual(["src", "lib"]);
  });

  it("is empty when the root area is the only one", () => {
    expect(majorAreasOf([area(".")])).toEqual([]);
  });
});

describe("rankMajorAreas", () => {
  it("leads with related areas instead of alphabetically-first unrelated ones (issue #48's axios layout)", () => {
    const areas = [
      ranked("docs/scripts"),
      ranked("examples"),
      ranked("examples/get"),
      ranked("lib", { dependencies: 6, dependents: 6 }),
      ranked("lib/adapters", { dependencies: 7, dependents: 3 }),
      ranked("lib/helpers", { dependencies: 2, dependents: 9 }),
    ];

    expect(names(rankMajorAreas(areas))).toEqual([
      "lib",
      "lib/helpers",
      "lib/adapters",
      "docs/scripts",
      "examples",
      "examples/get",
    ]);
  });

  it("lists tests, test-support, and tooling areas after every implementation area, however related", () => {
    const areas = [
      ranked("tests", { dependencies: 20, responsibility: "Tests" }),
      ranked("fixtures", {
        dependencies: 9,
        responsibility: "Test fixtures/support data",
      }),
      ranked("config", {
        dependents: 5,
        responsibility: "Build/tooling configuration",
      }),
      ranked("src/no-detected-relationships"),
      ranked("src/components", {
        dependents: 1,
        responsibility: "Presentational React components",
      }),
    ];

    expect(names(rankMajorAreas(areas))).toEqual([
      "src/components",
      "src/no-detected-relationships",
      "tests",
      "fixtures",
      "config",
    ]);
  });

  it("breaks relationship ties by entry point count, then by name", () => {
    const areas = [
      ranked("b", { dependencies: 1 }),
      ranked("a", { dependents: 1 }),
      ranked("c", { dependencies: 1, entryPoints: 2 }),
    ];

    expect(names(rankMajorAreas(areas))).toEqual(["c", "a", "b"]);
  });

  it("returns a new array, leaving the persisted order intact", () => {
    const areas = [ranked("a"), ranked("b", { dependencies: 1 })];

    rankMajorAreas(areas);

    expect(names(areas)).toEqual(["a", "b"]);
  });

  it("orders equal areas as equal", () => {
    expect(compareMajorAreas(ranked("a"), ranked("a"))).toBe(0);
  });

  it("falls back to entry points, then name, when no area has a detected relationship", () => {
    const areas = [
      ranked("pkg/b"),
      ranked("tests", { entryPoints: 3, responsibility: "Tests" }),
      ranked("pkg/a"),
      ranked("pkg/cli", { entryPoints: 1 }),
    ];

    expect(names(rankMajorAreas(areas))).toEqual([
      "pkg/cli",
      "pkg/a",
      "pkg/b",
      "tests",
    ]);
  });
});

describe("majorAreasOrderNote", () => {
  it("describes the relationship ranking when any area has a detected relationship", () => {
    expect(
      majorAreasOrderNote([ranked("a"), ranked("b", { dependents: 1 })])
    ).toMatch(/^Ordered by detected direct relationships/);
  });

  it("doesn't claim a relationship ordering when none were detected", () => {
    const note = majorAreasOrderNote([
      ranked("a"),
      ranked("b", { entryPoints: 2 }),
    ]);

    expect(note).toMatch(
      /^No direct relationships between areas were detected/
    );
    expect(note).toContain("entry points, then name");
  });
});
