import { Project } from "ts-morph";
import type { EntryPoint } from "@/lore/model";
import { extractPublicSurface } from "../public-surface";

function makeProject() {
  return new Project({ useInMemoryFileSystem: true });
}

function entryPoint(overrides: Partial<EntryPoint> = {}): EntryPoint {
  return {
    id: "entry-1",
    kind: "library",
    location: { filePath: "src/index.ts" },
    certainty: "detected",
    evidence: [],
    ...overrides,
  };
}

describe("extractPublicSurface", () => {
  it("extracts a directly declared named export", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/index.ts", "export const add = 1;");

    const contracts = extractPublicSurface(
      [entryPoint()],
      project.getSourceFiles(),
      "/root"
    );

    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      name: "add",
      kind: "export",
      areaId: "src/index.ts",
      location: { filePath: "src/index.ts", symbolName: "add" },
    });
    expect(contracts[0].evidence[0].location).toMatchObject({
      filePath: "src/index.ts",
    });
  });

  it("follows a re-export to where it is declared", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/math.ts", "export const add = 1;");
    project.createSourceFile(
      "/root/src/index.ts",
      "export { add } from './math';"
    );

    const contracts = extractPublicSurface(
      [entryPoint()],
      project.getSourceFiles(),
      "/root"
    );

    expect(contracts).toHaveLength(1);
    expect(contracts[0].evidence[0].location).toMatchObject({
      filePath: "src/math.ts",
      symbolName: "add",
    });
    expect(contracts[0].evidence[0].description).toContain("declared in");
  });

  it("ignores entry points whose kind is not a surface kind", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/index.ts", "export const add = 1;");

    const contracts = extractPublicSurface(
      [entryPoint({ kind: "bootstrap" })],
      project.getSourceFiles(),
      "/root"
    );

    expect(contracts).toEqual([]);
  });

  it("returns nothing when the entry point file is not among the discovered source files", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/other.ts", "export const x = 1;");

    const contracts = extractPublicSurface(
      [entryPoint({ location: { filePath: "src/index.ts" } })],
      project.getSourceFiles(),
      "/root"
    );

    expect(contracts).toEqual([]);
  });

  it("extracts multiple named exports from the same entry point", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      "export const add = 1;\nexport const subtract = 2;"
    );

    const contracts = extractPublicSurface(
      [entryPoint()],
      project.getSourceFiles(),
      "/root"
    );

    expect(contracts.map((c) => c.name).sort()).toEqual(["add", "subtract"]);
  });
});
