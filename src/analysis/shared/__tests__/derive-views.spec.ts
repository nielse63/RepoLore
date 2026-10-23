import type {
  EntryPoint,
  Evidence,
  Gap,
  PublicContract,
  Relationship,
  TestRelationship,
} from "@/lore/model";
import { START_HERE_MAX_ITEMS } from "@/lore/model";
import {
  deriveViews,
  findContradictedTestRoots,
  isUnderTestRoot,
  isUnderUncontradictedTestRoot,
  testRootPath,
  type DeriveViewsConfig,
  type DeriveViewsInput,
} from "../derive-views";

const evidence: Evidence = {
  kind: "test-evidence",
  certainty: "detected",
  description: "test evidence",
};

const noopConfig: DeriveViewsConfig = {
  isTestFile: () => false,
  isToolingConfigFile: () => false,
};

function baseInput(
  overrides: Partial<DeriveViewsInput> = {}
): DeriveViewsInput {
  return {
    projectId: "proj",
    sourceFilePaths: [],
    relationships: [],
    entryPoints: [],
    publicContracts: [],
    testRelationships: [],
    gaps: [],
    ...overrides,
  };
}

describe("deriveViews structural areas", () => {
  it("groups files one directory level under the root", () => {
    const input = baseInput({
      sourceFilePaths: [
        "src/components/Header.tsx",
        "src/components/Footer.tsx",
        "src/index.ts",
      ],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const names = structuralAreas.map((a) => a.name).sort();
    expect(names).toEqual(["src", "src/components"]);
  });

  it('groups a root-level file (no directory) into area "."', () => {
    const input = baseInput({ sourceFilePaths: ["index.ts"] });
    const { structuralAreas } = deriveViews(input, noopConfig);
    expect(structuralAreas.map((a) => a.name)).toEqual(["."]);
  });

  it("subdivides a two-segment area exceeding the file-count threshold into its real subdirectories", () => {
    // 12 files nested three-plus levels under "src/app" — over the
    // threshold for the default "src/app" bucket, and genuinely splittable
    // by subdirectory, unlike the flat-directory case below.
    const input = baseInput({
      sourceFilePaths: [
        "src/app/App.tsx",
        ...Array.from(
          { length: 11 },
          (_, i) => `src/app/components/Widget${i}.tsx`
        ),
      ],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const names = structuralAreas.map((a) => a.name).sort();
    expect(names).toEqual(["src/app", "src/app/components"]);
  });

  it("does not subdivide a flat directory exceeding the threshold when its files share no deeper structure", () => {
    const input = baseInput({
      sourceFilePaths: Array.from(
        { length: 12 },
        (_, i) => `src/components/Widget${i}.tsx`
      ),
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    expect(structuralAreas.map((a) => a.name)).toEqual(["src/components"]);
  });

  it("keeps a nested test directory's many small subdirectories as one Tests area rather than one area each", () => {
    // Svelte-shaped (GitHub issue #50): `packages/svelte/tests/<suite>/
    // samples/<case>/` held ~2,900 one-or-two-file cases, each becoming its
    // own "major area". The config's `isTestFile` recognizes none of these
    // files (as JS/TS's doesn't: neither a test filename nor a top-level
    // test directory), so the directory name alone must decide.
    const sampleFiles = "abcdefghijkl"
      .split("")
      .map((c) => `packages/x/tests/runtime/samples/${c}/_config.js`);
    const input = baseInput({
      sourceFilePaths: ["packages/x/src/index.ts", ...sampleFiles],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    expect(structuralAreas.map((a) => a.name).sort()).toEqual([
      "packages/x/src",
      "packages/x/tests",
    ]);
    const testsArea = structuralAreas.find(
      (a) => a.name === "packages/x/tests"
    );
    expect(testsArea?.responsibility).toBe("Tests");
    expect(testsArea?.productionFilePaths).toEqual([]);
    expect(testsArea?.rationale).toContain("conventional test directory");
    expect(
      testsArea?.evidence.find((e) => e.kind === "test-directory-convention")
        ?.description
    ).toBe(
      "0 source file(s) under 'packages/x/tests' are recognized as test files; the other 12 lie under a conventional test directory ('packages/x/tests') and are grouped as tests by directory name only, not recognized as individual test files."
    );
    const srcArea = structuralAreas.find((a) => a.name === "packages/x/src");
    expect(srcArea?.responsibility).toBeUndefined();
    expect(srcArea?.productionFilePaths).toEqual(["packages/x/src/index.ts"]);
  });

  it("groups a top-level test directory's subdirectories into one area named at the test root", () => {
    const input = baseInput({
      sourceFilePaths: [
        "src/index.ts",
        "tests/unit/a.ts",
        "tests/integration/b.ts",
        "__tests__/helpers/c.ts",
      ],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    expect(structuralAreas.map((a) => a.name).sort()).toEqual([
      "__tests__",
      "src",
      "tests",
    ]);
  });

  it("doesn't label a test-named directory as Tests when production code outside it imports it", () => {
    // Django-shaped: `django/test/` is shipped library code, not a suite.
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "django/core/management/commands/test.py",
        toId: "django/test/utils.py",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: [
        "django/core/management/commands/test.py",
        "django/test/client.py",
        "django/test/utils.py",
      ],
      relationships,
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const area = structuralAreas.find((a) => a.name === "django/test");
    expect(area?.responsibility).toBeUndefined();
    expect(area?.productionFilePaths).toEqual([
      "django/test/client.py",
      "django/test/utils.py",
    ]);
    expect(
      area?.evidence.find((e) => e.kind === "test-directory-name-contradicted")
    ).toMatchObject({
      certainty: "detected",
      description:
        "'django/test' is named like a test directory, but 'django/core/management/commands/test.py', outside any test directory, depends on 'django/test/utils.py', so its files aren't treated as tests by directory name.",
    });
  });

  it("doesn't label a test-named directory as Tests when it holds a non-test entry point", () => {
    // Next.js-shaped: `app/test` is an ordinary route segment.
    const input = baseInput({
      sourceFilePaths: [
        "src/app/page.tsx",
        "src/app/test/page.tsx",
        ...Array.from({ length: 10 }, (_, i) => `src/app/route${i}/page.tsx`),
      ],
      entryPoints: [
        {
          id: "entry-route",
          kind: "route",
          location: { filePath: "src/app/test/page.tsx" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const area = structuralAreas.find((a) => a.name === "src/app/test");
    expect(area?.responsibility).toBeUndefined();
    expect(area?.productionFilePaths).toEqual(["src/app/test/page.tsx"]);
    expect(
      area?.evidence.some((e) => e.kind === "test-directory-name-contradicted")
    ).toBe(true);
  });

  it("still labels a test directory as Tests when only test files or its own files import it", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/math.test.ts",
        toId: "pkg/tests/helpers.ts",
        certainty: "detected",
        evidence: [evidence],
      },
      {
        id: "rel-2",
        kind: "depends-on",
        fromId: "pkg/tests/run.ts",
        toId: "pkg/tests/helpers.ts",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: [
        "src/math.test.ts",
        "pkg/tests/helpers.ts",
        "pkg/tests/run.ts",
      ],
      relationships,
    });
    const config: DeriveViewsConfig = {
      ...noopConfig,
      isTestFile: (f) => f.endsWith(".test.ts"),
    };

    const { structuralAreas } = deriveViews(input, config);
    const area = structuralAreas.find((a) => a.name === "pkg/tests");
    expect(area?.responsibility).toBe("Tests");
    expect(area?.productionFilePaths).toEqual([]);
  });

  it("doesn't claim a flat test directory's subdirectories were kept together when it has none", () => {
    const input = baseInput({
      sourceFilePaths: ["pkg/tests/a.ts", "pkg/tests/b.ts"],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const area = structuralAreas.find((a) => a.name === "pkg/tests");
    expect(area?.responsibility).toBe("Tests");
    expect(area?.rationale).not.toContain("conventional test directory");
  });

  it("does not treat a directory merely containing 'test' in its name as a test root", () => {
    const input = baseInput({
      sourceFilePaths: [
        "src/testing/a.ts",
        "src/testing/b.ts",
        ...Array.from({ length: 11 }, (_, i) => `src/latest/sub${i}/x.ts`),
      ],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    expect(structuralAreas.map((a) => a.name)).toContain("src/testing");
    expect(structuralAreas.map((a) => a.name)).toContain("src/latest/sub0");
    expect(structuralAreas.every((a) => a.responsibility === undefined)).toBe(
      true
    );
  });

  it('marks an area as "Tests" when every file is a test file per the config', () => {
    const input = baseInput({ sourceFilePaths: ["src/math.test.ts"] });
    const config: DeriveViewsConfig = {
      ...noopConfig,
      isTestFile: (f) => f.endsWith(".test.ts"),
    };
    const { structuralAreas } = deriveViews(input, config);
    const area = structuralAreas.find((a) => a.name === "src");
    expect(area?.responsibility).toBe("Tests");
  });

  it("populates productionFilePaths with only non-test files, for a mixed area", () => {
    const input = baseInput({
      sourceFilePaths: ["src/math.ts", "src/math.test.ts"],
    });
    const config: DeriveViewsConfig = {
      ...noopConfig,
      isTestFile: (f) => f.endsWith(".test.ts"),
    };
    const { structuralAreas } = deriveViews(input, config);
    const area = structuralAreas.find((a) => a.name === "src");
    expect(area?.productionFilePaths).toEqual(["src/math.ts"]);
  });

  it("marks an area as test fixtures/support data under a fixtures directory", () => {
    const input = baseInput({ sourceFilePaths: ["fixtures/sample-data.ts"] });
    const { structuralAreas } = deriveViews(input, noopConfig);
    const area = structuralAreas.find((a) => a.name === "fixtures");
    expect(area?.responsibility).toBe("Test fixtures/support data");
  });

  it("marks an area as build/tooling configuration per the config", () => {
    const input = baseInput({ sourceFilePaths: ["setup.py"] });
    const config: DeriveViewsConfig = {
      ...noopConfig,
      isToolingConfigFile: (f) => f === "setup.py",
    };
    const { structuralAreas } = deriveViews(input, config);
    const area = structuralAreas.find((a) => a.name === ".");
    expect(area?.responsibility).toBe("Build/tooling configuration");
  });

  it("applies an optional detectSpecialAreaResponsibility hook", () => {
    const input = baseInput({ sourceFilePaths: ["src/widgets/Widget.ts"] });
    const config: DeriveViewsConfig = {
      ...noopConfig,
      detectSpecialAreaResponsibility: (files) =>
        files.every((f) => f.includes("widgets"))
          ? {
              responsibility: "Widgets",
              evidence: {
                kind: "widget-detection",
                certainty: "detected",
                description: "every file is a widget",
              },
            }
          : undefined,
    };
    const { structuralAreas } = deriveViews(input, config);
    const area = structuralAreas.find((a) => a.name === "src/widgets");
    expect(area?.responsibility).toBe("Widgets");
    expect(area?.evidence.some((e) => e.kind === "widget-detection")).toBe(
      true
    );
  });

  it("omits any special responsibility when the hook is not supplied", () => {
    const input = baseInput({ sourceFilePaths: ["src/widgets/Widget.ts"] });
    const { structuralAreas } = deriveViews(input, noopConfig);
    const area = structuralAreas.find((a) => a.name === "src/widgets");
    expect(area?.responsibility).toBeUndefined();
  });

  it("links direct dependency/dependent areas from relationships crossing area boundaries", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/index.ts",
        toId: "src/utils/math.ts",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/index.ts", "src/utils/math.ts"],
      relationships,
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const rootArea = structuralAreas.find((a) => a.name === "src");
    const utilsArea = structuralAreas.find((a) => a.name === "src/utils");

    expect(rootArea?.directDependencyIds).toEqual([utilsArea?.id]);
    expect(utilsArea?.directDependentIds).toEqual([rootArea?.id]);
  });

  it("links each pair of areas once, ignoring intra-area and unknown-file relationships", () => {
    const rel = (id: string, fromId: string, toId: string): Relationship => ({
      id,
      kind: "depends-on",
      fromId,
      toId,
      certainty: "detected",
      evidence: [evidence],
    });
    const input = baseInput({
      sourceFilePaths: ["src/a.ts", "src/b.ts", "src/utils/math.ts"],
      relationships: [
        rel("rel-1", "src/a.ts", "src/utils/math.ts"),
        rel("rel-2", "src/b.ts", "src/utils/math.ts"),
        rel("rel-3", "src/a.ts", "src/b.ts"),
        rel("rel-4", "src/a.ts", "vendor/missing.ts"),
        rel("rel-5", "vendor/missing.ts", "src/a.ts"),
      ],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const srcArea = structuralAreas.find((a) => a.name === "src");
    const utilsArea = structuralAreas.find((a) => a.name === "src/utils");
    expect(srcArea?.directDependencyIds).toEqual([utilsArea?.id]);
    expect(srcArea?.directDependentIds).toEqual([]);
    expect(utilsArea?.directDependentIds).toEqual([srcArea?.id]);
  });

  it("attaches each area's entry points, public contracts, tests, and located gaps", () => {
    const contract: PublicContract = {
      id: "contract-1",
      areaId: "area:proj:src/api",
      name: "handler",
      kind: "export",
      location: { filePath: "src/api/handler.ts" },
      evidence: [evidence],
    };
    const testRelationship: TestRelationship = {
      id: "test-1",
      testLocation: { filePath: "tests/handler.test.ts" },
      implementationLocation: { filePath: "src/api/handler.ts" },
      certainty: "detected",
      evidence: [evidence],
    };
    const locatedGap: Gap = {
      certainty: "unknown",
      description: "unresolved import",
      location: { filePath: "src/api/handler.ts" },
    };
    const unlocatedGap: Gap = {
      certainty: "unsupported",
      description: "repository-wide gap",
    };
    const input = baseInput({
      sourceFilePaths: [
        "src/main.ts",
        "src/api/handler.ts",
        "tests/handler.test.ts",
      ],
      entryPoints: [
        {
          id: "entry-main",
          kind: "bootstrap",
          location: { filePath: "src/main.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
      publicContracts: [contract],
      testRelationships: [testRelationship],
      gaps: [locatedGap, unlocatedGap],
    });

    const { structuralAreas } = deriveViews(input, noopConfig);
    const apiArea = structuralAreas.find((a) => a.name === "src/api");
    const srcArea = structuralAreas.find((a) => a.name === "src");
    const testsArea = structuralAreas.find((a) => a.name === "tests");

    expect(apiArea?.importantLocations).toEqual([
      { filePath: "src/api/handler.ts" },
    ]);
    expect(apiArea?.entryPointIds).toEqual([]);
    expect(apiArea?.gaps).toEqual([locatedGap]);
    // A test relationship belongs to both its test's and its subject's area.
    expect(apiArea?.testRelationshipIds).toEqual(["test-1"]);
    expect(testsArea?.testRelationshipIds).toEqual(["test-1"]);

    expect(srcArea?.entryPointIds).toEqual(["entry-main"]);
    expect(srcArea?.importantLocations).toEqual([{ filePath: "src/main.ts" }]);
    expect(srcArea?.gaps).toEqual([]);
    expect(srcArea?.testRelationshipIds).toEqual([]);
  });
});

describe("deriveViews start here", () => {
  function bootstrapEntry(filePath: string): EntryPoint {
    return {
      id: "entry-bootstrap",
      kind: "bootstrap",
      location: { filePath },
      certainty: "detected",
      evidence: [evidence],
    };
  }

  it("seeds with a bootstrap/cli entry point first", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere[0]).toMatchObject({
      order: 1,
      location: { filePath: "src/main.ts" },
      whatItRepresents: "Application bootstrap entry point",
    });
  });

  it("follows the dependency chain outward from the seed entry point", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/main.ts",
        toId: "src/app.ts",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", "src/app.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
      relationships,
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toContain(
      "src/app.ts"
    );
  });

  it("skips non-primary areas (tests, fixtures, tooling config) when padding", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", "fixtures/a.ts", "fixtures/b.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(
      startHere.some((item) => item.whatItRepresents.includes("fixtures"))
    ).toBe(false);
  });

  it("does not pad with a large nested test directory as a primary area", () => {
    // Once a nested `tests` directory is one area instead of many tiny ones
    // (GitHub issue #50), it's the largest area by file count — padding must
    // still skip it as non-primary rather than recommending it.
    const input = baseInput({
      sourceFilePaths: [
        "packages/x/src/main.ts",
        "packages/x/lib/util.ts",
        ...Array.from(
          { length: 12 },
          (_, i) => `packages/x/tests/samples/case${i}/_config.js`
        ),
      ],
      entryPoints: [bootstrapEntry("packages/x/src/main.ts")],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toEqual([
      "packages/x/src/main.ts",
      "packages/x/lib",
    ]);
  });

  it("closes with a representative test relationship when one exists", () => {
    const testRelationships: TestRelationship[] = [
      {
        id: "test-1",
        testLocation: { filePath: "src/main.test.ts" },
        implementationLocation: { filePath: "src/main.ts" },
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", "src/main.test.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
      testRelationships,
    });

    const { startHere } = deriveViews(input, noopConfig);
    const last = startHere[startHere.length - 1];
    expect(last.location.filePath).toBe("src/main.test.ts");
  });

  const dependsOn = (
    fromId: string,
    toId: string,
    certainty: Relationship["certainty"] = "detected",
    relEvidence: Evidence[] = [evidence]
  ): Relationship => ({
    id: `${fromId}->${toId}`,
    kind: "depends-on",
    fromId,
    toId,
    certainty,
    evidence: relEvidence,
  });

  it("caps many bootstrap entry points at the Start Here maximum", () => {
    const scripts = Array.from(
      { length: START_HERE_MAX_ITEMS + 3 },
      (_, i) => `scripts/s${i}.py`
    );
    const input = baseInput({
      sourceFilePaths: scripts,
      entryPoints: scripts.map(bootstrapEntry),
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toEqual(
      scripts.slice(0, START_HERE_MAX_ITEMS)
    );
  });

  it("seeds with a library's declared public entry point when nothing starts the system", () => {
    const input = baseInput({
      sourceFilePaths: ["src/index.ts", "src/cli-helpers.ts"],
      entryPoints: [
        {
          id: "entry-library",
          kind: "library",
          location: { filePath: "src/index.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
        {
          id: "entry-route",
          kind: "route",
          location: { filePath: "src/cli-helpers.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere).toHaveLength(1);
    expect(startHere[0]).toMatchObject({
      location: { filePath: "src/index.ts" },
      whatItRepresents: "Package's declared public entry point",
      rationale:
        "This is the system's declared public entry point for consumers.",
    });
  });

  it("follows detected dependencies before inferred ones, breadth-first, without repeating a file", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", "src/a.ts", "src/b.ts", "src/c.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
      relationships: [
        dependsOn("src/main.ts", "src/a.ts", "inferred"),
        dependsOn("src/main.ts", "src/b.ts"),
        dependsOn("src/a.ts", "src/c.ts"),
        // Already reached from main; not added a second time.
        dependsOn("src/b.ts", "src/a.ts"),
        dependsOn("src/c.ts", "src/main.ts"),
      ],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toEqual([
      "src/main.ts",
      "src/b.ts",
      "src/a.ts",
      "src/c.ts",
    ]);
    expect(startHere[1]).toMatchObject({
      whatItRepresents: "A module directly depended on by 'src/main.ts'",
      rationale: "test evidence",
      certainty: "detected",
    });
    expect(startHere[2].certainty).toBe("inferred");
  });

  it("adds a file once when the same entry imports it through two relationships", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", "src/a.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
      relationships: [
        { ...dependsOn("src/main.ts", "src/a.ts"), id: "import" },
        { ...dependsOn("src/main.ts", "src/a.ts"), id: "re-export" },
      ],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toEqual([
      "src/main.ts",
      "src/a.ts",
    ]);
  });

  it("describes a dependency from the relationship itself when it carries no evidence", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", "src/a.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
      relationships: [dependsOn("src/main.ts", "src/a.ts", "detected", [])],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere[1].rationale).toBe("'src/main.ts' depends on 'src/a.ts'.");
  });

  it("stops following the dependency chain at the cap, leaving room for a test", () => {
    const modules = Array.from({ length: 10 }, (_, i) => `src/m${i}.ts`);
    const input = baseInput({
      sourceFilePaths: ["src/main.ts", ...modules, "src/main.test.ts"],
      entryPoints: [bootstrapEntry("src/main.ts")],
      relationships: modules.map((m) => dependsOn("src/main.ts", m)),
      testRelationships: [
        {
          id: "test-1",
          testLocation: { filePath: "src/main.test.ts" },
          implementationLocation: { filePath: "src/main.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere).toHaveLength(START_HERE_MAX_ITEMS);
    expect(startHere.map((item) => item.location.filePath)).toEqual([
      "src/main.ts",
      ...modules.slice(0, START_HERE_MAX_ITEMS - 2),
      "src/main.test.ts",
    ]);
  });

  it("pads with larger unrepresented areas first, breaking ties by name", () => {
    const input = baseInput({
      sourceFilePaths: [
        "src/main.ts",
        "src/b/one.ts",
        "src/a/one.ts",
        "src/c/one.ts",
        "src/c/two.ts",
      ],
      entryPoints: [bootstrapEntry("src/main.ts")],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toEqual([
      "src/main.ts",
      "src/c",
      "src/a",
      "src/b",
    ]);
    expect(startHere[1]).toMatchObject({
      whatItRepresents: "Primary structural area: 'src/c'",
      certainty: "inferred",
    });
  });

  it("closes with the first test not already on the path, with a fallback rationale when it has no evidence", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.test.ts", "src/util.test.ts", "src/main.ts"],
      entryPoints: [bootstrapEntry("src/main.test.ts")],
      testRelationships: [
        {
          id: "test-1",
          testLocation: { filePath: "src/main.test.ts" },
          implementationLocation: { filePath: "src/main.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
        {
          id: "test-2",
          testLocation: { filePath: "src/util.test.ts" },
          implementationLocation: { filePath: "src/util.ts" },
          certainty: "inferred",
          evidence: [],
        },
      ],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere[startHere.length - 1]).toMatchObject({
      location: { filePath: "src/util.test.ts" },
      whatItRepresents: "Test for 'src/util.ts'",
      rationale:
        "Exercises the implementation directly; a good place to observe representative behavior.",
      certainty: "inferred",
    });
  });

  it("doesn't repeat a test that's already on the path", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.test.ts", "src/main.ts"],
      entryPoints: [bootstrapEntry("src/main.test.ts")],
      testRelationships: [
        {
          id: "test-1",
          testLocation: { filePath: "src/main.test.ts" },
          implementationLocation: { filePath: "src/main.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const { startHere } = deriveViews(input, noopConfig);
    expect(startHere.map((item) => item.location.filePath)).toEqual([
      "src/main.test.ts",
    ]);
  });
});

describe("isUnderTestRoot and testRootPath", () => {
  it.each([
    ["tests/a.ts", "tests"],
    ["packages/x/tests/runtime/a.ts", "packages/x/tests"],
    ["src/__tests__/a.ts", "src/__tests__"],
    ["e2e/home.spec.ts", "e2e"],
    // The outermost test root wins.
    ["pkg/test/sub/tests/a.py", "pkg/test"],
  ])("%s is under test root '%s'", (filePath, root) => {
    expect(isUnderTestRoot(filePath)).toBe(true);
    expect(testRootPath(filePath)).toBe(root);
  });

  it.each(["src/testing/a.ts", "src/test", "test.ts"])(
    "%s is not under a test root",
    (filePath) => {
      expect(isUnderTestRoot(filePath)).toBe(false);
    }
  );
});

describe("findContradictedTestRoots", () => {
  const entry = (kind: EntryPoint["kind"], filePath: string): EntryPoint => ({
    id: `${kind}-${filePath}`,
    kind,
    location: { filePath },
    certainty: "detected",
    evidence: [evidence],
  });

  it.each<[EntryPoint["kind"], string]>([
    ["bootstrap", "application bootstrap entry point"],
    ["cli", "command-line entry point"],
    ["runtime", "conventional runtime entry point"],
    ["library", "package's declared public entry point"],
    ["public-export", "public export entry point"],
    ["framework", "framework entry point"],
    ["route", "next.js route entry point"],
    ["http-handler", "http route handler entry point"],
    ["server-action", "server action entry point"],
    ["middleware", "middleware entry point"],
    ["ui-event", "ui event entry point"],
  ])("cites a %s entry point inside a test root", (kind, description) => {
    const contradictions = findContradictedTestRoots(
      { entryPoints: [entry(kind, "pkg/tests/x.ts")], relationships: [] },
      () => false
    );
    expect(contradictions).toEqual(
      new Map([
        ["pkg/tests", `'pkg/tests/x.ts' is detected as a ${description}`],
      ])
    );
  });

  it("ignores test entry points and entry points outside any test root", () => {
    const contradictions = findContradictedTestRoots(
      {
        entryPoints: [
          entry("test", "pkg/tests/x.test.ts"),
          entry("bootstrap", "src/main.ts"),
        ],
        relationships: [],
      },
      () => false
    );
    expect(contradictions.size).toBe(0);
  });

  it("keeps the first contradiction found for each root", () => {
    const dependsOn = (fromId: string, toId: string): Relationship => ({
      id: `${fromId}->${toId}`,
      kind: "depends-on",
      fromId,
      toId,
      certainty: "detected",
      evidence: [evidence],
    });
    const contradictions = findContradictedTestRoots(
      {
        entryPoints: [
          entry("route", "app/test/page.tsx"),
          entry("route", "app/test/other/page.tsx"),
        ],
        relationships: [
          dependsOn("src/a.ts", "app/test/page.tsx"),
          dependsOn("src/a.ts", "django/test/utils.py"),
          dependsOn("src/b.ts", "django/test/client.py"),
        ],
      },
      () => false
    );
    expect(contradictions).toEqual(
      new Map([
        [
          "app/test",
          "'app/test/page.tsx' is detected as a next.js route entry point",
        ],
        [
          "django/test",
          "'src/a.ts', outside any test directory, depends on 'django/test/utils.py'",
        ],
      ])
    );
  });
});

describe("isUnderUncontradictedTestRoot", () => {
  const dependsOn = (fromId: string, toId: string): Relationship => ({
    id: `${fromId}->${toId}`,
    kind: "depends-on",
    fromId,
    toId,
    certainty: "detected",
    evidence: [evidence],
  });

  it("is true for a file under a test directory at any depth", () => {
    const isUnder = isUnderUncontradictedTestRoot(
      { entryPoints: [], relationships: [] },
      () => false
    );
    expect(isUnder("packages/x/tests/helpers.ts")).toBe(true);
    expect(isUnder("pkg/tests/run_all.py")).toBe(true);
    expect(isUnder("tests/foo.js")).toBe(true);
    expect(isUnder("packages/x/src/index.ts")).toBe(false);
    // The file name alone isn't a test root; only a directory is.
    expect(isUnder("src/test")).toBe(false);
  });

  it("is false under a test directory that production code imports", () => {
    const isUnder = isUnderUncontradictedTestRoot(
      {
        entryPoints: [],
        relationships: [
          dependsOn("packages/core/src/compile.ts", "packages/test/assert.ts"),
        ],
      },
      () => false
    );
    expect(isUnder("packages/test/assert.ts")).toBe(false);
    expect(isUnder("packages/core/tests/run.ts")).toBe(true);
  });

  it("ignores imports from other test files or test directories", () => {
    const isUnder = isUnderUncontradictedTestRoot(
      {
        entryPoints: [],
        relationships: [
          dependsOn("src/app.test.ts", "packages/x/tests/helpers.ts"),
          dependsOn("e2e/home.ts", "packages/x/tests/helpers.ts"),
        ],
      },
      (f) => f.endsWith(".test.ts")
    );
    expect(isUnder("packages/x/tests/helpers.ts")).toBe(true);
  });

  it("is false under a test directory holding a non-test entry point", () => {
    const route: EntryPoint = {
      id: "route",
      kind: "framework",
      location: { filePath: "app/test/page.tsx" },
      certainty: "detected",
      evidence: [evidence],
    };
    const isUnder = isUnderUncontradictedTestRoot(
      { entryPoints: [route], relationships: [] },
      () => false
    );
    expect(isUnder("app/test/helpers.ts")).toBe(false);
  });
});
