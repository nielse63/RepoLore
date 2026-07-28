import type {
  EntryPoint,
  Evidence,
  Relationship,
  TestRelationship,
} from "@/lore/model";
import { derivePythonViews, type PythonViewsInput } from "../derive-views";

const evidence: Evidence = {
  kind: "test-evidence",
  certainty: "detected",
  description: "test evidence",
};

function baseInput(
  overrides: Partial<PythonViewsInput> = {}
): PythonViewsInput {
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

describe("derivePythonViews structural areas", () => {
  it("groups files one directory level under the root", () => {
    const input = baseInput({
      sourceFilePaths: ["src/pkg/core.py", "src/pkg/cli.py", "src/main.py"],
    });

    const { structuralAreas } = derivePythonViews(input);
    const names = structuralAreas.map((a) => a.name).sort();
    expect(names).toEqual(["src", "src/pkg"]);
  });

  it('groups a root-level file (no directory) into area "."', () => {
    const input = baseInput({ sourceFilePaths: ["main.py"] });
    const { structuralAreas } = derivePythonViews(input);
    expect(structuralAreas.map((a) => a.name)).toEqual(["."]);
  });

  it('marks an area as "Tests" when every file is a pytest-style test file', () => {
    const input = baseInput({ sourceFilePaths: ["src/test_core.py"] });
    const { structuralAreas } = derivePythonViews(input);
    const area = structuralAreas.find((a) => a.name === "src");
    expect(area?.responsibility).toBe("Tests");
  });

  it('marks an area as "Tests" for a top-level tests directory', () => {
    const input = baseInput({ sourceFilePaths: ["tests/test_core.py"] });
    const { structuralAreas } = derivePythonViews(input);
    const area = structuralAreas.find((a) => a.name === "tests");
    expect(area?.responsibility).toBe("Tests");
  });

  it("marks an area as test fixtures/support data under a fixtures directory", () => {
    const input = baseInput({ sourceFilePaths: ["fixtures/sample_data.py"] });
    const { structuralAreas } = derivePythonViews(input);
    const area = structuralAreas.find((a) => a.name === "fixtures");
    expect(area?.responsibility).toBe("Test fixtures/support data");
  });

  it("marks setup.py as build/tooling configuration", () => {
    const input = baseInput({ sourceFilePaths: ["setup.py"] });
    const { structuralAreas } = derivePythonViews(input);
    const area = structuralAreas.find((a) => a.name === ".");
    expect(area?.responsibility).toBe("Build/tooling configuration");
  });

  it("does not mark a nested setup.py-named file as tooling config", () => {
    const input = baseInput({ sourceFilePaths: ["src/pkg/setup.py"] });
    const { structuralAreas } = derivePythonViews(input);
    const area = structuralAreas.find((a) => a.name === "src/pkg");
    expect(area?.responsibility).toBeUndefined();
  });

  it("links direct dependency/dependent areas from relationships crossing area boundaries", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/cli.py",
        toId: "src/pkg/core.py",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/cli.py", "src/pkg/core.py"],
      relationships,
    });

    const { structuralAreas } = derivePythonViews(input);
    const srcArea = structuralAreas.find((a) => a.name === "src");
    const pkgArea = structuralAreas.find((a) => a.name === "src/pkg");

    expect(srcArea?.directDependencyIds).toEqual([pkgArea?.id]);
    expect(pkgArea?.directDependentIds).toEqual([srcArea?.id]);
  });
});

describe("derivePythonViews start here", () => {
  function cliEntry(filePath: string): EntryPoint {
    return {
      id: "entry-cli",
      kind: "cli",
      location: { filePath },
      certainty: "detected",
      evidence: [evidence],
    };
  }

  it("seeds with a console-script/cli entry point first", () => {
    const input = baseInput({
      sourceFilePaths: ["src/pkg/cli.py"],
      entryPoints: [cliEntry("src/pkg/cli.py")],
    });

    const { startHere } = derivePythonViews(input);
    expect(startHere[0]).toMatchObject({
      order: 1,
      location: { filePath: "src/pkg/cli.py" },
      whatItRepresents: "Command-line entry point",
    });
  });

  it("falls back to a library entry point when there is no bootstrap/cli entry", () => {
    const input = baseInput({
      sourceFilePaths: ["src/pkg/__init__.py"],
      entryPoints: [
        {
          id: "entry-lib",
          kind: "library",
          location: { filePath: "src/pkg/__init__.py" },
          certainty: "detected",
          evidence: [evidence],
        },
      ],
    });

    const { startHere } = derivePythonViews(input);
    expect(startHere[0]).toMatchObject({
      whatItRepresents: "Package's declared public entry point",
    });
  });

  it("follows the dependency chain outward from the seed entry point", () => {
    const relationships: Relationship[] = [
      {
        id: "rel-1",
        kind: "depends-on",
        fromId: "src/pkg/cli.py",
        toId: "src/pkg/core.py",
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/pkg/cli.py", "src/pkg/core.py"],
      entryPoints: [cliEntry("src/pkg/cli.py")],
      relationships,
    });

    const { startHere } = derivePythonViews(input);
    expect(startHere.map((item) => item.location.filePath)).toContain(
      "src/pkg/core.py"
    );
  });

  it("skips non-primary areas (tests, setup.py) when padding", () => {
    const input = baseInput({
      sourceFilePaths: ["src/pkg/cli.py", "setup.py"],
      entryPoints: [cliEntry("src/pkg/cli.py")],
    });

    const { startHere } = derivePythonViews(input);
    expect(
      startHere.some((item) => item.whatItRepresents.includes("'.'"))
    ).toBe(false);
  });

  it("closes with a representative test relationship when one exists", () => {
    const testRelationships: TestRelationship[] = [
      {
        id: "test-1",
        testLocation: { filePath: "tests/test_core.py" },
        implementationLocation: { filePath: "src/pkg/core.py" },
        certainty: "detected",
        evidence: [evidence],
      },
    ];
    const input = baseInput({
      sourceFilePaths: ["src/pkg/cli.py", "tests/test_core.py"],
      entryPoints: [cliEntry("src/pkg/cli.py")],
      testRelationships,
    });

    const { startHere } = derivePythonViews(input);
    const last = startHere[startHere.length - 1];
    expect(last.location.filePath).toBe("tests/test_core.py");
  });

  it("produces no items when there are no entry points and every area is non-primary", () => {
    const input = baseInput({ sourceFilePaths: ["tests/test_a.py"] });
    const { startHere } = derivePythonViews(input);
    expect(startHere).toEqual([]);
  });
});
