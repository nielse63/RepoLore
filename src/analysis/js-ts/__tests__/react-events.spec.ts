import { Project, ScriptTarget, ts } from "ts-morph";
import { buildCallableIndex } from "../callable-index";
import { detectReactEvents } from "../react-events";

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

describe("detectReactEvents", () => {
  it("resolves a bare function reference passed as an event handler", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Form.tsx",
      `function submit() {}
       function Form() {
         return <button onClick={submit}>Go</button>;
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const edges = detectReactEvents(project.getSourceFiles(), "/root", index);

    const form = index.all.find((c) => c.signature.name === "Form")!;
    const submit = index.all.find((c) => c.signature.name === "submit")!;
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: form.signature.id,
      target: submit.signature.id,
      type: "EVENT",
      certainty: "detected",
    });
  });

  it("unwraps a single-call closure to the named function underneath", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Form.tsx",
      `function submit() {}
       function Form() {
         return <button onClick={() => submit()}>Go</button>;
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const edges = detectReactEvents(project.getSourceFiles(), "/root", index);

    const submit = index.all.find((c) => c.signature.name === "submit")!;
    expect(edges).toHaveLength(1);
    expect(edges[0].target).toBe(submit.signature.id);
  });

  it("does not resolve a multi-statement closure", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Form.tsx",
      `function submit() {}
       function Form() {
         return <button onClick={() => { console.log("go"); submit(); }}>Go</button>;
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const edges = detectReactEvents(project.getSourceFiles(), "/root", index);
    expect(edges).toHaveLength(0);
  });

  it("ignores non-event JSX attributes", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Form.tsx",
      `function Form() {
         return <button className="primary">Go</button>;
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const edges = detectReactEvents(project.getSourceFiles(), "/root", index);
    expect(edges).toHaveLength(0);
  });

  it("does not resolve a handler reference that isn't a known named callable", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Form.tsx",
      `function Form() {
         return <button onClick={undeclaredHandler}>Go</button>;
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const edges = detectReactEvents(project.getSourceFiles(), "/root", index);
    expect(edges).toHaveLength(0);
  });
});
