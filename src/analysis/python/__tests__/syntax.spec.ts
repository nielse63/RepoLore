import type { Parser } from "web-tree-sitter";
import { createPythonParser, parsePythonSource } from "../parser";
import {
  descendantsOfType,
  directChildrenOfType,
  isStringLiteral,
  isTopLevel,
  lineOf,
  nodesEqual,
  stringLiteralValue,
} from "../syntax";

let parser: Parser;

beforeAll(async () => {
  parser = await createPythonParser();
});

function parse(source: string) {
  return parsePythonSource(parser, source).rootNode;
}

describe("descendantsOfType", () => {
  it("finds every node of a given type at any depth", () => {
    const root = parse(
      "def outer():\n    def inner():\n        pass\n    return inner\n"
    );
    const functions = descendantsOfType(root, "function_definition");
    expect(functions).toHaveLength(2);
  });

  it("returns an empty array when no node matches", () => {
    const root = parse("x = 1\n");
    expect(descendantsOfType(root, "function_definition")).toEqual([]);
  });
});

describe("directChildrenOfType", () => {
  it("only returns immediate children, not deeper descendants", () => {
    const root = parse("import a, b\n");
    const importStmt = descendantsOfType(root, "import_statement")[0];
    const dottedNames = directChildrenOfType(importStmt, "dotted_name");
    expect(dottedNames.map((n) => n.text)).toEqual(["a", "b"]);
  });
});

describe("lineOf", () => {
  it("returns the 1-indexed line a node starts on", () => {
    const root = parse("x = 1\ny = 2\ndef foo():\n    pass\n");
    const fn = descendantsOfType(root, "function_definition")[0];
    expect(lineOf(fn)).toBe(3);
  });
});

describe("nodesEqual", () => {
  it("is true for two wrappers referring to the same underlying node", () => {
    const root = parse("x = 1\n");
    expect(nodesEqual(root.child(0)?.parent, root)).toBe(true);
  });

  it("is false when either argument is null/undefined", () => {
    const root = parse("x = 1\n");
    expect(nodesEqual(root, null)).toBe(false);
    expect(nodesEqual(undefined, root)).toBe(false);
  });

  it("is false for two different nodes", () => {
    const root = parse("x = 1\ny = 2\n");
    const [first, second] = descendantsOfType(root, "assignment");
    expect(nodesEqual(first, second)).toBe(false);
  });
});

describe("isTopLevel", () => {
  it("is true for a direct module-level statement", () => {
    const root = parse("def foo():\n    pass\n");
    const fn = descendantsOfType(root, "function_definition")[0];
    expect(isTopLevel(fn, root)).toBe(true);
  });

  it("is true for a decorated top-level definition", () => {
    const root = parse("@dataclass\nclass Foo:\n    pass\n");
    const cls = descendantsOfType(root, "class_definition")[0];
    expect(isTopLevel(cls, root)).toBe(true);
  });

  it("is false for a nested definition", () => {
    const root = parse("def outer():\n    def inner():\n        pass\n");
    const inner = descendantsOfType(root, "function_definition")[1];
    expect(isTopLevel(inner, root)).toBe(false);
  });
});

describe("isStringLiteral / stringLiteralValue", () => {
  it("recognizes a string node and extracts its content", () => {
    const root = parse('x = "hello"\n');
    const assignment = descendantsOfType(root, "assignment")[0];
    const right = assignment.childForFieldName("right");
    expect(right).toBeTruthy();
    expect(isStringLiteral(right!)).toBe(true);
    expect(stringLiteralValue(right!)).toBe("hello");
  });

  it("is false for a non-string node", () => {
    const root = parse("x = 1\n");
    const assignment = descendantsOfType(root, "assignment")[0];
    const right = assignment.childForFieldName("right");
    expect(isStringLiteral(right!)).toBe(false);
  });
});
