import { createPythonParser, parsePythonSource } from "../parser";

describe("createPythonParser / parsePythonSource", () => {
  it("creates a parser that produces a real module-rooted syntax tree", async () => {
    const parser = await createPythonParser();
    const tree = parsePythonSource(parser, "def foo():\n    pass\n");

    expect(tree.rootNode.type).toBe("module");
    expect(tree.rootNode.childCount).toBeGreaterThan(0);
  });

  it("reuses the initialized runtime/grammar across multiple parser instances", async () => {
    const first = await createPythonParser();
    const second = await createPythonParser();

    expect(parsePythonSource(first, "x = 1").rootNode.type).toBe("module");
    expect(parsePythonSource(second, "y = 2").rootNode.type).toBe("module");
  });

  it("throws if the underlying parser fails to produce a tree", async () => {
    const parser = await createPythonParser();
    jest.spyOn(parser, "parse").mockReturnValue(null);

    expect(() => parsePythonSource(parser, "x = 1")).toThrow(
      "tree-sitter-python failed to parse source text"
    );

    jest.restoreAllMocks();
  });
});
