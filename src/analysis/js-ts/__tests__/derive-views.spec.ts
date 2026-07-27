import type {
  EntryPoint,
  Evidence,
  PublicContract,
  Relationship,
  TestRelationship,
} from "@/lore/model";
import { deriveJsTsViews, type JsTsViewsInput } from "../derive-views";

const evidence: Evidence = {
  kind: "test-evidence",
  certainty: "detected",
  description: "test evidence",
};

function baseInput(overrides: Partial<JsTsViewsInput> = {}): JsTsViewsInput {
  return {
    projectId: "proj",
    sourceFilePaths: [],
    relationships: [],
    entryPoints: [],
    publicContracts: [],
    testRelationships: [],
    reactComponents: [],
    gaps: [],
    ...overrides,
  };
}

describe("deriveJsTsViews structural areas", () => {
  it("groups files one directory level under the root", () => {
    const input = baseInput({
      sourceFilePaths: [
        "src/components/Header.tsx",
        "src/components/Footer.tsx",
        "src/index.ts",
      ],
    });

    const { structuralAreas } = deriveJsTsViews(input);
    const names = structuralAreas.map((a) => a.name).sort();
    expect(names).toEqual(["src", "src/components"]);
  });

  it('groups a root-level file (no directory) into area "."', () => {
    const input = baseInput({ sourceFilePaths: ["index.ts"] });
    const { structuralAreas } = deriveJsTsViews(input);
    expect(structuralAreas.map((a) => a.name)).toEqual(["."]);
  });

  it('marks an area as "Presentational React components" when every file is a detected component', () => {
    const input = baseInput({
      sourceFilePaths: ["src/components/Header.tsx"],
      reactComponents: [
        {
          name: "Header",
          location: { filePath: "src/components/Header.tsx" },
          evidence,
        },
      ],
    });

    const { structuralAreas } = deriveJsTsViews(input);
    const area = structuralAreas.find((a) => a.name === "src/components");
    expect(area?.responsibility).toBe("Presentational React components");
  });

  it('marks an area as "Tests" when every file is a test file', () => {
    const input = baseInput({
      sourceFilePaths: ["src/math.test.ts"],
    });

    const { structuralAreas } = deriveJsTsViews(input);
    const area = structuralAreas.find((a) => a.name === "src");
    expect(area?.responsibility).toBe("Tests");
  });

  it("marks an area as test fixtures/support data under a fixtures directory", () => {
    const input = baseInput({
      sourceFilePaths: ["fixtures/sample-data.ts"],
    });

    const { structuralAreas } = deriveJsTsViews(input);
    const area = structuralAreas.find((a) => a.name === "fixtures");
    expect(area?.responsibility).toBe("Test fixtures/support data");
  });

  it("marks an area as build/tooling configuration for known config files", () => {
    const input = baseInput({
      sourceFilePaths: ["jest.config.js"],
    });

    const { structuralAreas } = deriveJsTsViews(input);
    const area = structuralAreas.find((a) => a.name === ".");
    expect(area?.responsibility).toBe("Build/tooling configuration");
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

    const { structuralAreas } = deriveJsTsViews(input);
    const rootArea = structuralAreas.find((a) => a.name === "src");
    const utilsArea = structuralAreas.find((a) => a.name === "src/utils");

    expect(rootArea?.directDependencyIds).toEqual([utilsArea?.id]);
    expect(utilsArea?.directDependentIds).toEqual([rootArea?.id]);
  });

  it("does not link a relationship within the same area as a dependency", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/a.ts",
        toId: "src/b.ts",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/a.ts", "src/b.ts"],
      relationships,
    });

    const { structuralAreas } = deriveJsTsViews(input);
    const area = structuralAreas.find((a) => a.name === "src");
    expect(area?.directDependencyIds).toEqual([]);
  });
});

describe("deriveJsTsViews start here", () => {
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
      sourceFilePaths: ["src/main.tsx"],
      entryPoints: [bootstrapEntry("src/main.tsx")],
    });

    const { startHere } = deriveJsTsViews(input);
    expect(startHere[0]).toMatchObject({
      order: 1,
      location: { filePath: "src/main.tsx" },
      whatItRepresents: "Application bootstrap entry point",
    });
  });

  it("falls back to a library entry point when there is no bootstrap/cli entry", () => {
    const input = baseInput({
      sourceFilePaths: ["src/index.ts"],
      entryPoints: [
        {
          id: "entry-lib",
          kind: "library",
          location: { filePath: "src/index.ts" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const { startHere } = deriveJsTsViews(input);
    expect(startHere[0]).toMatchObject({
      whatItRepresents: "Package's declared public entry point",
    });
  });

  it("follows the dependency chain outward from the seed entry point", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/main.tsx",
        toId: "src/app.tsx",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/main.tsx", "src/app.tsx"],
      entryPoints: [bootstrapEntry("src/main.tsx")],
      relationships,
    });

    const { startHere } = deriveJsTsViews(input);
    expect(startHere.map((item) => item.location.filePath)).toContain(
      "src/app.tsx"
    );
  });

  it("pads with the largest not-yet-represented major area", () => {
    const input = baseInput({
      sourceFilePaths: [
        "src/main.tsx",
        "src/big/one.ts",
        "src/big/two.ts",
        "src/big/three.ts",
      ],
      entryPoints: [bootstrapEntry("src/main.tsx")],
    });

    const { startHere } = deriveJsTsViews(input);
    expect(
      startHere.some((item) => item.whatItRepresents.includes("src/big"))
    ).toBe(true);
  });

  it("skips non-primary areas (tests, fixtures, tooling config) when padding", () => {
    const input = baseInput({
      sourceFilePaths: ["src/main.tsx", "fixtures/a.ts", "fixtures/b.ts"],
      entryPoints: [bootstrapEntry("src/main.tsx")],
    });

    const { startHere } = deriveJsTsViews(input);
    expect(
      startHere.some((item) => item.whatItRepresents.includes("fixtures"))
    ).toBe(false);
  });

  it("closes with a representative test relationship when one exists", () => {
    const testRelationships: TestRelationship[] = [
      {
        id: "test-1",
        testLocation: { filePath: "src/main.test.tsx" },
        implementationLocation: { filePath: "src/main.tsx" },
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/main.tsx", "src/main.test.tsx"],
      entryPoints: [bootstrapEntry("src/main.tsx")],
      testRelationships,
    });

    const { startHere } = deriveJsTsViews(input);
    const last = startHere[startHere.length - 1];
    expect(last.location.filePath).toBe("src/main.test.tsx");
  });

  it("produces no items when there are no entry points and every area is non-primary", () => {
    const input = baseInput({ sourceFilePaths: ["src/a.test.ts"] });
    const { startHere } = deriveJsTsViews(input);
    expect(startHere).toEqual([]);
  });

  it("still pads with a primary area even with no entry points, relationships, or tests", () => {
    const input = baseInput({ sourceFilePaths: ["src/a.ts"] });
    const { startHere } = deriveJsTsViews(input);
    expect(startHere).toHaveLength(1);
    expect(startHere[0].whatItRepresents).toContain("src");
  });

  it("caps items at START_HERE_MAX_ITEMS", () => {
    const publicContracts: PublicContract[] = [];
    const relationships: Relationship[] = [];
    const filePaths = ["src/main.tsx"];
    for (let i = 0; i < 10; i += 1) {
      const dep = `src/dep${i}.ts`;
      filePaths.push(dep);
      relationships.push({
        id: `rel-${i}`,
        kind: "depends-on",
        fromId: "src/main.tsx",
        toId: dep,
        certainty: "detected",
        evidence: [evidence],
      });
    }
    const input = baseInput({
      sourceFilePaths: filePaths,
      entryPoints: [bootstrapEntry("src/main.tsx")],
      relationships,
      publicContracts,
    });

    const { startHere } = deriveJsTsViews(input);
    expect(startHere.length).toBeLessThanOrEqual(7);
  });
});
