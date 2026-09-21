import type {
  EntryPoint,
  Evidence,
  Relationship,
  TestRelationship,
} from "@/lore/model";
import {
  deriveViews,
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
});
