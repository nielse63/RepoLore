import { Project } from "ts-morph";
import { buildCallableIndex } from "../callable-index";
import { detectReactState } from "../react-hooks";

function makeProject() {
  return new Project({ useInMemoryFileSystem: true });
}

describe("detectReactState", () => {
  it("produces a detected STATE_WRITE edge when a named function calls the setter", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Component.ts",
      `function Component() {
         const [status, setStatus] = useState("idle");
         function markDone() {
           setStatus("done");
         }
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectReactState(
      project.getSourceFiles(),
      "/root",
      index
    );

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({ kind: "state", name: "status" });

    const markDone = index.all.find((c) => c.signature.name === "markDone")!;
    const write = edges.find((e) => e.type === "STATE_WRITE");
    expect(write).toMatchObject({
      source: markDone.signature.id,
      target: nodes[0].id,
      certainty: "detected",
    });
  });

  it("produces an inferred STATE_READ edge when a named function references the value", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Component.ts",
      `function Component() {
         const [status, setStatus] = useState("idle");
         function logStatus() {
           console.log(status);
         }
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { edges } = detectReactState(
      project.getSourceFiles(),
      "/root",
      index
    );

    const logStatus = index.all.find((c) => c.signature.name === "logStatus")!;
    const read = edges.find((e) => e.type === "STATE_READ");
    expect(read).toMatchObject({
      source: logStatus.signature.id,
      certainty: "inferred",
    });
  });

  it("marks a state read/written only from one function as local", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Component.ts",
      `function Component() {
         const [count, setCount] = useState(0);
         function increment() {
           setCount(count + 1);
         }
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes } = detectReactState(
      project.getSourceFiles(),
      "/root",
      index
    );
    expect(nodes[0].stateScope).toBe("local");
  });

  it("marks a state read/written from more than one function as shared", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Component.ts",
      `function Component() {
         const [count, setCount] = useState(0);
         function increment() {
           setCount(count + 1);
         }
         function reset() {
           setCount(0);
         }
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes } = detectReactState(
      project.getSourceFiles(),
      "/root",
      index
    );
    expect(nodes[0].stateScope).toBe("shared");
  });

  it("supports useReducer the same way as useState", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Component.ts",
      `function Component() {
         const [state, dispatch] = useReducer(reducer, initial);
         function act() {
           dispatch({ type: "go" });
         }
       }`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectReactState(
      project.getSourceFiles(),
      "/root",
      index
    );
    expect(nodes).toHaveLength(1);
    expect(edges.some((e) => e.type === "STATE_WRITE")).toBe(true);
  });

  it("skips a useState call that isn't inside a named function", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Component.ts",
      `const [status, setStatus] = useState("idle");`
    );
    const index = buildCallableIndex(project.getSourceFiles(), "/root");
    const { nodes, edges } = detectReactState(
      project.getSourceFiles(),
      "/root",
      index
    );
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
