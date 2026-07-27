import type { Parser } from "web-tree-sitter";
import type { EntryPoint } from "@/lore/model";
import type { PythonSourceFile } from "../discovery";
import { createPythonParser, parsePythonSource } from "../parser";
import { extractPublicSurface } from "../public-surface";

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

function libraryEntryPoint(filePath: string): EntryPoint {
  return {
    id: "entry-1",
    kind: "library",
    location: { filePath },
    certainty: "detected",
    evidence: [],
  };
}

describe("extractPublicSurface", () => {
  it("uses a declared __all__ when present", () => {
    const files = [
      file("pkg/__init__.py", 'def foo():\n    pass\n\n__all__ = ["foo"]\n'),
    ];

    const contracts = extractPublicSurface(
      [libraryEntryPoint("pkg/__init__.py")],
      files
    );

    expect(contracts).toHaveLength(1);
    expect(contracts[0]).toMatchObject({
      name: "foo",
      kind: "export",
      areaId: "pkg/__init__.py",
    });
    expect(contracts[0].evidence[0].kind).toBe("dunder-all-declaration");
  });

  it("infers public surface from non-underscore top-level definitions when there is no __all__", () => {
    const files = [
      file(
        "pkg/__init__.py",
        "def foo():\n    pass\n\ndef _private():\n    pass\n\nclass Bar:\n    pass\n"
      ),
    ];

    const contracts = extractPublicSurface(
      [libraryEntryPoint("pkg/__init__.py")],
      files
    );

    expect(contracts.map((c) => c.name).sort()).toEqual(["Bar", "foo"]);
    expect(contracts[0].evidence[0].kind).toBe(
      "package-init-surface-convention"
    );
  });

  it("includes re-exported names imported at the top level", () => {
    const files = [file("pkg/__init__.py", "from pkg.core import add\n")];

    const contracts = extractPublicSurface(
      [libraryEntryPoint("pkg/__init__.py")],
      files
    );

    expect(contracts.map((c) => c.name)).toEqual(["add"]);
  });

  it("excludes underscore-prefixed re-exports", () => {
    const files = [file("pkg/__init__.py", "from pkg.core import _helper\n")];

    const contracts = extractPublicSurface(
      [libraryEntryPoint("pkg/__init__.py")],
      files
    );

    expect(contracts).toEqual([]);
  });

  it("ignores entry points that are not a library kind", () => {
    const files = [file("pkg/__init__.py", "def foo():\n    pass\n")];
    const entryPoint: EntryPoint = {
      id: "entry-1",
      kind: "cli",
      location: { filePath: "pkg/__init__.py" },
      certainty: "detected",
      evidence: [],
    };

    const contracts = extractPublicSurface([entryPoint], files);
    expect(contracts).toEqual([]);
  });

  it("returns nothing when the entry point file is not among the source files", () => {
    const files = [file("pkg/other.py", "")];
    const contracts = extractPublicSurface(
      [libraryEntryPoint("pkg/__init__.py")],
      files
    );
    expect(contracts).toEqual([]);
  });
});
