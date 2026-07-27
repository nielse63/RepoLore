import { Project } from "ts-morph";
import { extractTestRelationships, isTestFile } from "../tests";

function makeProject() {
  return new Project({ useInMemoryFileSystem: true });
}

describe("isTestFile", () => {
  it("recognizes .test. and .spec. suffixes", () => {
    expect(isTestFile("src/math.test.ts")).toBe(true);
    expect(isTestFile("src/math.spec.tsx")).toBe(true);
  });

  it("recognizes files under a __tests__ directory", () => {
    expect(isTestFile("src/__tests__/math.ts")).toBe(true);
  });

  it("recognizes files under a top-level test/ or tests/ directory", () => {
    expect(isTestFile("test/foo.js")).toBe(true);
    expect(isTestFile("tests/foo.js")).toBe(true);
  });

  it("is false for ordinary implementation files", () => {
    expect(isTestFile("src/math.ts")).toBe(false);
  });
});

describe("extractTestRelationships", () => {
  it("prefers a non-entry-point relative import as the strongest signal", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/math.ts", "");
    project.createSourceFile(
      "/root/src/math.test.ts",
      "import { add } from './math';"
    );

    const { testRelationships, gaps } = extractTestRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(gaps).toEqual([]);
    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0]).toMatchObject({
      testLocation: { filePath: "src/math.test.ts" },
      implementationLocation: { filePath: "src/math.ts" },
      certainty: "detected",
    });
  });

  it("demotes an entry-point-only import below a directory mirror match", () => {
    const project = makeProject();
    project.createSourceFile("/root/index.ts", "");
    project.createSourceFile("/root/lib/arguments/cwd.ts", "");
    project.createSourceFile(
      "/root/test/arguments/cwd.ts",
      "import '../../index';"
    );

    const { testRelationships } = extractTestRelationships(
      project.getSourceFiles(),
      "/root",
      new Set(["index.ts"])
    );

    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0]).toMatchObject({
      implementationLocation: { filePath: "lib/arguments/cwd.ts" },
      certainty: "inferred",
    });
  });

  it("falls back to the entry-point import when no mirror match exists", () => {
    const project = makeProject();
    project.createSourceFile("/root/index.ts", "");
    project.createSourceFile("/root/test/foo.ts", "import '../index';");

    const { testRelationships } = extractTestRelationships(
      project.getSourceFiles(),
      "/root",
      new Set(["index.ts"])
    );

    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0]).toMatchObject({
      implementationLocation: { filePath: "index.ts" },
      certainty: "detected",
    });
  });

  it("falls back to filename convention when no relative import resolves", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/math.ts", "");
    project.createSourceFile("/root/src/math.test.ts", "");

    const { testRelationships } = extractTestRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(testRelationships).toHaveLength(1);
    expect(testRelationships[0]).toMatchObject({
      implementationLocation: { filePath: "src/math.ts" },
      certainty: "inferred",
    });
  });

  it("records an unknown gap when no implementation can be matched", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/orphan.test.ts", "");

    const { testRelationships, gaps } = extractTestRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(testRelationships).toEqual([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].certainty).toBe("unknown");
  });
});
