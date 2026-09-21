import { Project, ScriptTarget, ts } from "ts-morph";
import type { EntityId } from "@/lore/model";
import { buildCallableIndex } from "../callable-index";
import { detectReactEffects } from "../react-effects";

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

describe("detectReactEffects", () => {
  it("uses a tracked dependency's state id as the edge source", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function submit() {}
       function Widget() {
         useEffect(() => { submit(); }, [value]);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const widget = index.all.find((c) => c.signature.name === "Widget")!;
    const submit = index.all.find((c) => c.signature.name === "submit")!;
    const bindings = new Map<EntityId, Map<string, EntityId>>([
      [widget.signature.id, new Map([["value", "state-1"]])],
    ]);

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      bindings
    );

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: "state-1",
      target: submit.signature.id,
      type: "FRAMEWORK",
      certainty: "inferred",
    });
  });

  it("falls back to the owning function when the deps array is empty", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function submit() {}
       function Widget() {
         useEffect(() => { submit(); }, []);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const widget = index.all.find((c) => c.signature.name === "Widget")!;
    const submit = index.all.find((c) => c.signature.name === "submit")!;

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      new Map()
    );

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(widget.signature.id);
    expect(edges[0].target).toBe(submit.signature.id);
  });

  it("falls back to the owning function when there is no deps array at all", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function submit() {}
       function Widget() {
         useEffect(() => { submit(); });
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const widget = index.all.find((c) => c.signature.name === "Widget")!;

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      new Map()
    );

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(widget.signature.id);
  });

  it("falls back to the owning function when a dep isn't a tracked state value", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function submit() {}
       function Widget() {
         useEffect(() => { submit(); }, [other]);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const widget = index.all.find((c) => c.signature.name === "Widget")!;
    const bindings = new Map<EntityId, Map<string, EntityId>>([
      [widget.signature.id, new Map([["value", "state-1"]])],
    ]);

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      bindings
    );

    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe(widget.signature.id);
  });

  it("also detects useLayoutEffect", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function submit() {}
       function Widget() {
         useLayoutEffect(() => { submit(); }, []);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const submit = index.all.find((c) => c.signature.name === "submit")!;

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      new Map()
    );

    expect(edges).toHaveLength(1);
    expect(edges[0].target).toBe(submit.signature.id);
  });

  it("deduplicates repeated calls to the same function within one effect body", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function submit() {}
       function Widget() {
         useEffect(() => { submit(); submit(); }, []);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      new Map()
    );

    expect(edges).toHaveLength(1);
  });

  it("does not resolve a bare named-function reference as the effect callback", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function namedEffect() {}
       function Widget() {
         useEffect(namedEffect, []);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      new Map()
    );

    expect(edges).toHaveLength(0);
  });

  it("produces no edges when the effect body calls nothing resolvable", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      `function Widget() {
         useEffect(() => { console.log("mounted"); }, []);
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");

    const edges = detectReactEffects(
      project.getSourceFiles(),
      "/root",
      index,
      new Map()
    );

    expect(edges).toHaveLength(0);
  });
});
