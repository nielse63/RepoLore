import { Project } from "ts-morph";
import { extractCallGraph } from "../call-graph";

function makeProject() {
  return new Project({ useInMemoryFileSystem: true });
}

function signatureNamed(
  signatures: ReturnType<typeof extractCallGraph>["callableSignatures"],
  name: string
) {
  return signatures.find((s) => s.name === name);
}

describe("extractCallGraph", () => {
  it("records a same-file call between two named functions", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `function b() { return 1; }
       function a() { return b(); }`
    );

    const { callableSignatures, callEdges } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    expect(callableSignatures.map((s) => s.name).sort()).toEqual(["a", "b"]);
    expect(callEdges).toHaveLength(1);
    const a = signatureNamed(callableSignatures, "a")!;
    const b = signatureNamed(callableSignatures, "b")!;
    expect(callEdges[0]).toMatchObject({
      callerId: a.id,
      calleeId: b.id,
      certainty: "detected",
    });
  });

  it("resolves a call to a named function imported via a relative specifier", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/math.ts",
      "export function add(x: number, y: number): number { return x + y; }"
    );
    project.createSourceFile(
      "/root/src/index.ts",
      `import { add } from './math';
       function run() { return add(1, 2); }`
    );

    const { callableSignatures, callEdges } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    const run = signatureNamed(callableSignatures, "run")!;
    const add = signatureNamed(callableSignatures, "add")!;
    expect(callEdges).toHaveLength(1);
    expect(callEdges[0]).toMatchObject({ callerId: run.id, calleeId: add.id });
  });

  it("resolves a call through an aliased named import to the original declared name", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/math.ts",
      "export function add(x: number, y: number) { return x + y; }"
    );
    project.createSourceFile(
      "/root/src/index.ts",
      `import { add as sum } from './math';
       function run() { return sum(1, 2); }`
    );

    const { callableSignatures, callEdges } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    const run = signatureNamed(callableSignatures, "run")!;
    const add = signatureNamed(callableSignatures, "add")!;
    expect(callEdges).toHaveLength(1);
    expect(callEdges[0]).toMatchObject({ callerId: run.id, calleeId: add.id });
  });

  it("captures explicit parameter and return type annotations, and marks missing ones unknown", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `function typed(x: number, y: string): boolean { return x > 0; }
       function untyped(x) { return x; }`
    );

    const { callableSignatures } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    const typed = signatureNamed(callableSignatures, "typed")!;
    expect(typed.parameters).toEqual([
      { name: "x", typeAnnotation: "number", certainty: "detected" },
      { name: "y", typeAnnotation: "string", certainty: "detected" },
    ]);
    expect(typed.returnType).toBe("boolean");
    expect(typed.returnCertainty).toBe("detected");

    const untyped = signatureNamed(callableSignatures, "untyped")!;
    expect(untyped.parameters).toEqual([{ name: "x", certainty: "unknown" }]);
    expect(untyped.returnCertainty).toBe("unknown");
    expect(untyped.returnType).toBeUndefined();
  });

  it("does not record an edge for a method/property-access call", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `const obj = { greet() { return 'hi'; } };
       function run() { return obj.greet(); }`
    );

    const { callEdges } = extractCallGraph(project.getSourceFiles(), "/root");

    expect(callEdges).toEqual([]);
  });

  it("does not record an edge for a call to an external/unresolved identifier, and does not gap it", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `function run() { return externalHelper(1); }`
    );

    const { callEdges, callableSignatures } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    expect(callEdges).toEqual([]);
    expect(callableSignatures.map((s) => s.name)).toEqual(["run"]);
  });

  it("does not track an anonymous function expression or arrow function as a callable", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `[1, 2, 3].map((x) => x + 1);
       setTimeout(function () {}, 10);`
    );

    const { callableSignatures } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    expect(callableSignatures).toEqual([]);
  });

  it("tracks a named arrow function assigned to a variable, and resolves calls to it", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `const helper = (x: number) => x * 2;
       function run() { return helper(3); }`
    );

    const { callableSignatures, callEdges } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    const helper = signatureNamed(callableSignatures, "helper")!;
    expect(helper.kind).toBe("arrow");
    expect(callEdges).toHaveLength(1);
    expect(callEdges[0].calleeId).toBe(helper.id);
  });

  it("tracks a class method as a callable with kind 'method'", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/index.ts",
      `class Service {
         run(): void {}
       }`
    );

    const { callableSignatures } = extractCallGraph(
      project.getSourceFiles(),
      "/root"
    );

    expect(signatureNamed(callableSignatures, "run")).toMatchObject({
      kind: "method",
    });
  });

  it("does not attribute a call made at module scope to any caller", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/util.ts",
      "export function helper() { return 1; }"
    );
    project.createSourceFile(
      "/root/src/index.ts",
      `import { helper } from './util';
       helper();`
    );

    const { callEdges } = extractCallGraph(project.getSourceFiles(), "/root");

    expect(callEdges).toEqual([]);
  });
});
