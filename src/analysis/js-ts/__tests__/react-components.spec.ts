import { Project, ScriptTarget, ts } from "ts-morph";
import { detectReactComponents } from "../react-components";

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

describe("detectReactComponents", () => {
  it("detects a function declaration returning JSX", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Header.tsx",
      "function Header() { return <div>hi</div>; }"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");

    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({
      name: "Header",
      location: { filePath: "src/Header.tsx", symbolName: "Header" },
    });
  });

  it("detects an arrow function component assigned to a const", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Footer.tsx",
      "const Footer = () => <footer>bye</footer>;"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");

    expect(components).toHaveLength(1);
    expect(components[0].name).toBe("Footer");
  });

  it("detects a class component extending React.Component", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      "class Widget extends React.Component { render() { return <div />; } }"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");

    expect(components).toHaveLength(1);
    expect(components[0]).toMatchObject({ name: "Widget" });
    expect(components[0].evidence.kind).toBe("react-class-component");
  });

  it("detects a class component extending bare Component", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Widget.tsx",
      "import { Component } from 'react';\nclass Widget extends Component { render() { return <div />; } }"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");
    expect(components.map((c) => c.name)).toContain("Widget");
  });

  it("ignores a class that does not extend Component", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/NotAComponent.tsx",
      "class NotAComponent extends Error {}"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");
    expect(components).toEqual([]);
  });

  it("ignores functions that do not return JSX", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/util.tsx",
      "function add(a: number, b: number) { return a + b; }"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");
    expect(components).toEqual([]);
  });

  it("only inspects .tsx/.jsx files", () => {
    const project = makeProject();
    project.createSourceFile(
      "/root/src/Header.ts",
      "function Header() { return null; }"
    );

    const components = detectReactComponents(project.getSourceFiles(), "/root");
    expect(components).toEqual([]);
  });
});
