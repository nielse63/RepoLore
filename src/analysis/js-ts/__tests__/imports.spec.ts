import { Project } from "ts-morph";
import { extractImportRelationships } from "../imports";

function makeProject() {
  return new Project({ useInMemoryFileSystem: true });
}

describe("extractImportRelationships", () => {
  it("records a relationship for a resolved relative import", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/math.ts", "export const add = 1;");
    project.createSourceFile(
      "/root/src/index.ts",
      "import { add } from './math';"
    );

    const { relationships, gaps } = extractImportRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(gaps).toEqual([]);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      kind: "depends-on",
      fromId: "src/index.ts",
      toId: "src/math.ts",
      certainty: "detected",
    });
  });

  it("records a relationship for a resolved re-export", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/math.ts", "export const add = 1;");
    project.createSourceFile(
      "/root/src/index.ts",
      "export { add } from './math';"
    );

    const { relationships } = extractImportRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      fromId: "src/index.ts",
      toId: "src/math.ts",
    });
  });

  it("produces an unknown gap for an unresolved relative import", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      "import { add } from './missing';"
    );

    const { relationships, gaps } = extractImportRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(relationships).toEqual([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ certainty: "unknown" });
    expect(gaps[0].description).toContain("./missing");
  });

  it("skips relative asset imports without recording a gap", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      "import logo from './logo.svg';"
    );

    const { relationships, gaps } = extractImportRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(relationships).toEqual([]);
    expect(gaps).toEqual([]);
  });

  it("produces an unsupported gap for a path-alias import", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      "import { Header } from '@/components/Header';"
    );

    const { gaps } = extractImportRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(gaps).toHaveLength(1);
    expect(gaps[0].certainty).toBe("unsupported");
  });

  it("ignores bare package specifiers as internal relationships/gaps, but records them as external references", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      "import React from 'react';"
    );

    const { relationships, gaps, externalReferences } =
      extractImportRelationships(project.getSourceFiles(), "/root");

    expect(relationships).toEqual([]);
    expect(gaps).toEqual([]);
    expect(externalReferences).toEqual([
      { specifier: "react", importerPath: "src/index.ts", line: 1 },
    ]);
  });

  it("assigns sequential, stable relationship ids", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/a.ts", "");
    project.createSourceFile("/root/src/b.ts", "");
    project.createSourceFile(
      "/root/src/index.ts",
      "import './a';\nimport './b';"
    );

    const { relationships } = extractImportRelationships(
      project.getSourceFiles(),
      "/root"
    );

    expect(relationships.map((r) => r.id)).toEqual([
      "js-ts-import-1",
      "js-ts-import-2",
    ]);
  });
});
