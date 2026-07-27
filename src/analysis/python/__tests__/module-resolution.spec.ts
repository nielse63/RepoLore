import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Parser } from "web-tree-sitter";
import type { PythonSourceFile } from "../discovery";
import { createPythonParser, parsePythonSource } from "../parser";
import {
  buildModuleResolutionIndex,
  detectSourceRoots,
  relativeBaseDir,
} from "../module-resolution";

let parser: Parser;

beforeAll(async () => {
  parser = await createPythonParser();
});

function makeSourceFile(
  rootDir: string,
  relativePath: string
): PythonSourceFile {
  const absolutePath = path.join(rootDir, relativePath);
  return {
    absolutePath,
    relativePath,
    sourceText: "",
    tree: parsePythonSource(parser, ""),
  };
}

describe("detectSourceRoots", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "repolore-py-roots-"));
  });

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("returns only the repository root when there is no src/ directory", () => {
    expect(detectSourceRoots(rootDir)).toEqual([path.resolve(rootDir)]);
  });

  it("prefers src/ over the repository root when both exist", async () => {
    await fsp.mkdir(path.join(rootDir, "src"), { recursive: true });
    expect(detectSourceRoots(rootDir)).toEqual([
      path.join(path.resolve(rootDir), "src"),
      path.resolve(rootDir),
    ]);
  });
});

describe("relativeBaseDir", () => {
  it('returns the file"s own directory at level 1', () => {
    const sourceFile = makeSourceFile("/root", "pkg/sub/mod.py");
    expect(relativeBaseDir(sourceFile, 1)).toBe(path.join("/root", "pkg/sub"));
  });

  it("walks up one directory per additional level", () => {
    const sourceFile = makeSourceFile("/root", "pkg/sub/mod.py");
    expect(relativeBaseDir(sourceFile, 2)).toBe(path.join("/root", "pkg"));
    expect(relativeBaseDir(sourceFile, 3)).toBe("/root");
  });
});

describe("buildModuleResolutionIndex", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "repolore-py-index-"));
  });

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("resolves a dotted module path to a .py module file under the root", () => {
    const files = [makeSourceFile(rootDir, "pkg/core.py")];
    const index = buildModuleResolutionIndex(files, rootDir);
    expect(index.resolveUnderRoots(["pkg", "core"])).toBe(files[0]);
  });

  it("resolves a dotted package path to its __init__.py", () => {
    const files = [makeSourceFile(rootDir, "pkg/__init__.py")];
    const index = buildModuleResolutionIndex(files, rootDir);
    expect(index.resolveUnderRoots(["pkg"])).toBe(files[0]);
  });

  it("resolves under an explicit base directory", () => {
    const files = [makeSourceFile(rootDir, "pkg/sibling.py")];
    const index = buildModuleResolutionIndex(files, rootDir);
    const baseDir = path.join(path.resolve(rootDir), "pkg");
    expect(index.resolveUnderBase(baseDir, ["sibling"])).toBe(files[0]);
  });

  it("returns undefined for an unresolvable module path", () => {
    const files = [makeSourceFile(rootDir, "pkg/core.py")];
    const index = buildModuleResolutionIndex(files, rootDir);
    expect(index.resolveUnderRoots(["missing"])).toBeUndefined();
  });

  it("returns undefined for an empty segment list", () => {
    const files = [makeSourceFile(rootDir, "pkg/core.py")];
    const index = buildModuleResolutionIndex(files, rootDir);
    expect(index.resolveUnderBase(rootDir, [])).toBeUndefined();
  });

  it("prefers a src/ source root over the repository root", async () => {
    await fsp.mkdir(path.join(rootDir, "src"), { recursive: true });
    const files = [makeSourceFile(rootDir, "src/pkg/core.py")];
    const index = buildModuleResolutionIndex(files, rootDir);
    expect(index.resolveUnderRoots(["pkg", "core"])).toBe(files[0]);
  });
});
