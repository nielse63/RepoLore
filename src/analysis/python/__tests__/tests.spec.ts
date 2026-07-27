import type { Parser } from "web-tree-sitter";
import type { PythonSourceFile } from "../discovery";
import { createPythonParser, parsePythonSource } from "../parser";
import { extractTestRelationships, isTestFile } from "../tests";

let parser: Parser;

beforeAll(async () => {
  parser = await createPythonParser();
});

function file(relativePath: string): PythonSourceFile {
  return {
    absolutePath: `/root/${relativePath}`,
    relativePath,
    sourceText: "",
    tree: parsePythonSource(parser, ""),
  };
}

describe("isTestFile", () => {
  it("recognizes test_*.py and *_test.py filenames", () => {
    expect(isTestFile("pkg/test_core.py")).toBe(true);
    expect(isTestFile("pkg/core_test.py")).toBe(true);
  });

  it("recognizes files under a top-level test/ or tests/ directory", () => {
    expect(isTestFile("test/test_core.py")).toBe(true);
    expect(isTestFile("tests/core.py")).toBe(true);
  });

  it("is false for ordinary implementation files", () => {
    expect(isTestFile("pkg/core.py")).toBe(false);
  });
});

describe("extractTestRelationships", () => {
  it("uses an already-resolved import as the strongest signal", () => {
    const files = [file("pkg/core.py"), file("pkg/test_core.py")];
    const resolvedDependenciesByFile = new Map([
      ["pkg/test_core.py", ["pkg/core.py"]],
    ]);

    const { testRelationships, gaps } = extractTestRelationships(
      files,
      resolvedDependenciesByFile
    );

    expect(gaps).toEqual([]);
    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0]).toMatchObject({
      testLocation: { filePath: "pkg/test_core.py" },
      implementationLocation: { filePath: "pkg/core.py" },
      certainty: "detected",
    });
  });

  it("excludes a resolved dependency that is itself a test file", () => {
    const files = [file("pkg/test_helpers.py"), file("pkg/test_core.py")];
    const resolvedDependenciesByFile = new Map([
      ["pkg/test_core.py", ["pkg/test_helpers.py"]],
    ]);

    const { testRelationships, gaps } = extractTestRelationships(
      files,
      resolvedDependenciesByFile
    );

    expect(testRelationships).toEqual([]);
    expect(gaps).toHaveLength(2);
  });

  it("falls back to filename convention (test_foo.py -> foo.py)", () => {
    const files = [file("pkg/core.py"), file("pkg/test_core.py")];
    const { testRelationships } = extractTestRelationships(files, new Map());

    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0]).toMatchObject({
      implementationLocation: { filePath: "pkg/core.py" },
      certainty: "inferred",
    });
  });

  it("falls back to filename convention (foo_test.py -> foo.py)", () => {
    const files = [file("pkg/core.py"), file("pkg/core_test.py")];
    const { testRelationships } = extractTestRelationships(files, new Map());

    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0].implementationLocation.filePath).toBe(
      "pkg/core.py"
    );
  });

  it("records an unknown gap when no implementation can be matched", () => {
    const files = [file("pkg/test_orphan.py")];
    const { testRelationships, gaps } = extractTestRelationships(
      files,
      new Map()
    );

    expect(testRelationships).toEqual([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].certainty).toBe("unknown");
  });
});
