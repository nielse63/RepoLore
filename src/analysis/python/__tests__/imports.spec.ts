import type { Parser } from "web-tree-sitter";
import type { PythonSourceFile } from "../discovery";
import { createPythonParser, parsePythonSource } from "../parser";
import { extractImportRelationships, parseImportedNames } from "../imports";
import { descendantsOfType } from "../syntax";

let parser: Parser;

beforeAll(async () => {
  parser = await createPythonParser();
});

function file(relativePath: string, sourceText: string): PythonSourceFile {
  return {
    absolutePath: `/root/${relativePath}`,
    relativePath,
    sourceText,
    tree: parsePythonSource(parser, sourceText),
  };
}

describe("extractImportRelationships", () => {
  it('resolves a bare "import pkg.core" statement', () => {
    const files = [
      file("pkg/__init__.py", ""),
      file("pkg/core.py", ""),
      file("pkg/main.py", "import pkg.core\n"),
    ];

    const { relationships, gaps } = extractImportRelationships(files, "/root");

    expect(gaps).toEqual([]);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toMatchObject({
      fromId: "pkg/main.py",
      toId: "pkg/core.py",
      kind: "depends-on",
      certainty: "detected",
    });
  });

  it("does not record a gap for an unresolvable bare import (stdlib/third-party)", () => {
    const files = [file("pkg/main.py", "import os\nimport requests\n")];
    const { relationships, gaps } = extractImportRelationships(files, "/root");
    expect(relationships).toEqual([]);
    expect(gaps).toEqual([]);
  });

  it('resolves "from pkg import core" preferring the submodule shape', () => {
    const files = [
      file("pkg/__init__.py", ""),
      file("pkg/core.py", ""),
      file("pkg/main.py", "from pkg import core\n"),
    ];

    const { relationships } = extractImportRelationships(files, "/root");
    expect(relationships).toHaveLength(1);
    expect(relationships[0].toId).toBe("pkg/core.py");
  });

  it("falls back to the module itself when the submodule shape does not resolve", () => {
    const files = [
      file("pkg/core.py", ""),
      file("pkg/main.py", "from pkg.core import add\n"),
    ];

    const { relationships } = extractImportRelationships(files, "/root");
    expect(relationships).toHaveLength(1);
    expect(relationships[0].toId).toBe("pkg/core.py");
  });

  it('resolves a relative "from . import x" against the importing package', () => {
    const files = [
      file("pkg/__init__.py", ""),
      file("pkg/core.py", ""),
      file("pkg/main.py", "from . import core\n"),
    ];

    const { relationships } = extractImportRelationships(files, "/root");
    expect(relationships).toHaveLength(1);
    expect(relationships[0].toId).toBe("pkg/core.py");
  });

  it("records a gap for an unresolved relative import", () => {
    const files = [file("pkg/main.py", "from .missing import x\n")];
    const { relationships, gaps } = extractImportRelationships(files, "/root");
    expect(relationships).toEqual([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].certainty).toBe("unknown");
  });

  it('resolves "from ..core import x" walking up an extra directory level', () => {
    const files = [
      file("pkg/core.py", ""),
      file("pkg/sub/main.py", "from ..core import x\n"),
    ];

    const { relationships } = extractImportRelationships(files, "/root");
    expect(relationships).toHaveLength(1);
    expect(relationships[0].toId).toBe("pkg/core.py");
  });

  it("dedupes multiple names imported from the same target into one relationship", () => {
    const files = [
      file("pkg/core.py", ""),
      file("pkg/main.py", "from pkg import core\nfrom pkg.core import a, b\n"),
    ];

    const { relationships } = extractImportRelationships(files, "/root");
    const toCore = relationships.filter((r) => r.toId === "pkg/core.py");
    expect(toCore).toHaveLength(1);
  });

  it("records resolvedDependenciesByFile keyed by each source file", () => {
    const files = [
      file("pkg/core.py", ""),
      file("pkg/main.py", "from pkg import core\n"),
    ];

    const { resolvedDependenciesByFile } = extractImportRelationships(
      files,
      "/root"
    );
    expect(resolvedDependenciesByFile.get("pkg/main.py")).toEqual([
      "pkg/core.py",
    ]);
    expect(resolvedDependenciesByFile.get("pkg/core.py")).toEqual([]);
  });
});

describe("parseImportedNames", () => {
  function fromImportStatement(source: string) {
    const root = parsePythonSource(parser, source).rootNode;
    return descendantsOfType(root, "import_from_statement")[0];
  }

  it("parses plain imported names", () => {
    const stmt = fromImportStatement("from pkg import a, b\n");
    expect(parseImportedNames(stmt)).toEqual({
      names: ["a", "b"],
      isWildcard: false,
    });
  });

  it("parses aliased imports by their original name", () => {
    const stmt = fromImportStatement("from pkg import a as aliased\n");
    expect(parseImportedNames(stmt)).toEqual({
      names: ["a"],
      isWildcard: false,
    });
  });

  it("detects a wildcard import", () => {
    const stmt = fromImportStatement("from pkg import *\n");
    expect(parseImportedNames(stmt)).toEqual({ names: [], isWildcard: true });
  });
});
