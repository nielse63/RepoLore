import { Project, ScriptTarget, ts } from "ts-morph";
import { buildCallableIndex } from "../callable-index";
import { detectBoundaries } from "../boundary-detectors";

function makeProject() {
  return new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
}

describe("detectBoundaries", () => {
  it("detects a well-known global boundary referenced inside a named function", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/api.ts",
      `function loadUser() {
         return fetch("/api/user");
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    const loadUser = index.all.find((c) => c.signature.name === "loadUser")!;
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      kind: "boundary",
      name: "fetch",
      boundaryType: "http",
    });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: loadUser.signature.id,
      target: nodes[0].id,
      type: "IO",
      certainty: "detected",
    });
  });

  it("resolves a package-boundary reference through a default import", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/api.ts",
      `import axios from "axios";
       function loadUser() {
         return axios.get("/user");
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ name: "axios", boundaryType: "http" });
    expect(edges).toHaveLength(1);
  });

  it("resolves a package-boundary reference through a namespace import", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/api.ts",
      `import * as fs from "fs";
       function readConfig() {
         return fs.readFileSync("config.json");
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ name: "fs", boundaryType: "filesystem" });
    expect(edges).toHaveLength(1);
  });

  it("resolves a package-boundary reference through a named import", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/store.ts",
      `import { readFileSync } from "fs";
       function readConfig() {
         return readFileSync("config.json");
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      name: "readFileSync",
      boundaryType: "filesystem",
    });
    expect(edges).toHaveLength(1);
  });

  it("deduplicates repeated references to the same boundary within one function", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/api.ts",
      `function loadTwice() {
         fetch("/a");
         fetch("/b");
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(1);
  });

  it("emits a separate edge per enclosing function for the same boundary node", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/api.ts",
      `function first() { fetch("/a"); }
       function second() { fetch("/b"); }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(1);
    expect(edges).toHaveLength(2);
    const sources = edges.map((e) => e.source).sort();
    const first = index.all.find((c) => c.signature.name === "first")!;
    const second = index.all.find((c) => c.signature.name === "second")!;
    expect(sources).toEqual([first.signature.id, second.signature.id].sort());
  });

  it("ignores the import binding itself when the imported name is never used", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/store.ts",
      `import { readFileSync } from "fs";
       function noop() {}`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("ignores a boundary reference outside any named function", () => {
    const project = makeProject();
    project.createSourceFile("/root/src/api.ts", `fetch("/api/user");`);
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("ignores an unrelated identifier that isn't a known boundary", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/util.ts",
      `function double(value: number) { return value * 2; }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectBoundaries(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
