import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  discoverSourceFiles,
  isExcludedDirectoryName,
  isExcludedPath,
} from "../discovery";

describe("isExcludedDirectoryName", () => {
  it("is true for known excluded directory names", () => {
    expect(isExcludedDirectoryName("__pycache__")).toBe(true);
    expect(isExcludedDirectoryName(".venv")).toBe(true);
    expect(isExcludedDirectoryName("node_modules")).toBe(true);
  });

  it("is true for any *.egg-info directory", () => {
    expect(isExcludedDirectoryName("mypkg.egg-info")).toBe(true);
  });

  it("is false for ordinary directory names", () => {
    expect(isExcludedDirectoryName("src")).toBe(false);
  });
});

describe("isExcludedPath", () => {
  it("is true when any path segment is excluded", () => {
    expect(isExcludedPath("src/.venv/lib/foo.py")).toBe(true);
  });

  it("is false for ordinary paths", () => {
    expect(isExcludedPath("src/pkg/foo.py")).toBe(false);
  });
});

describe("discoverSourceFiles", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "repolore-py-discovery-")
    );
  });

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("discovers .py files and parses each into a tree", async () => {
    await fsp.mkdir(path.join(rootDir, "pkg"), { recursive: true });
    await fsp.writeFile(path.join(rootDir, "pkg/__init__.py"), "");
    await fsp.writeFile(
      path.join(rootDir, "pkg/core.py"),
      "def foo():\n    pass\n"
    );
    await fsp.writeFile(path.join(rootDir, "README.md"), "");

    const sourceFiles = await discoverSourceFiles(rootDir);

    expect(sourceFiles.map((sf) => sf.relativePath)).toEqual([
      "pkg/__init__.py",
      "pkg/core.py",
    ]);
    const core = sourceFiles.find((sf) => sf.relativePath === "pkg/core.py");
    expect(core?.tree.rootNode.type).toBe("module");
    expect(core?.sourceText).toContain("def foo");
  });

  it("excludes conventional non-source directories at any depth", async () => {
    await fsp.mkdir(path.join(rootDir, "src"), { recursive: true });
    await fsp.writeFile(path.join(rootDir, "src/main.py"), "");

    for (const dir of ["__pycache__", ".venv", "venv", "build", "dist"]) {
      await fsp.mkdir(path.join(rootDir, dir), { recursive: true });
      await fsp.writeFile(path.join(rootDir, dir, "ignored.py"), "");
    }
    await fsp.mkdir(path.join(rootDir, "nested/site-packages"), {
      recursive: true,
    });
    await fsp.writeFile(
      path.join(rootDir, "nested/site-packages/ignored.py"),
      ""
    );

    const sourceFiles = await discoverSourceFiles(rootDir);
    expect(sourceFiles.map((sf) => sf.relativePath)).toEqual(["src/main.py"]);
  });

  it("excludes fixtures, __fixtures__, and __mocks__ directories at any depth", async () => {
    await fsp.mkdir(path.join(rootDir, "src"), { recursive: true });
    await fsp.writeFile(path.join(rootDir, "src/main.py"), "");

    for (const dir of ["fixtures/pyapp", "__fixtures__", "src/pkg/__mocks__"]) {
      await fsp.mkdir(path.join(rootDir, dir), { recursive: true });
      await fsp.writeFile(path.join(rootDir, dir, "ignored.py"), "");
    }

    const sourceFiles = await discoverSourceFiles(rootDir);
    expect(sourceFiles.map((sf) => sf.relativePath)).toEqual(["src/main.py"]);
  });

  it("returns files sorted by relative path", async () => {
    await fsp.mkdir(path.join(rootDir, "b"), { recursive: true });
    await fsp.mkdir(path.join(rootDir, "a"), { recursive: true });
    await fsp.writeFile(path.join(rootDir, "b/mod.py"), "");
    await fsp.writeFile(path.join(rootDir, "a/mod.py"), "");

    const sourceFiles = await discoverSourceFiles(rootDir);
    expect(sourceFiles.map((sf) => sf.relativePath)).toEqual([
      "a/mod.py",
      "b/mod.py",
    ]);
  });

  it("returns an empty array for a directory with no .py files", async () => {
    await fsp.writeFile(path.join(rootDir, "README.md"), "");
    const sourceFiles = await discoverSourceFiles(rootDir);
    expect(sourceFiles).toEqual([]);
  });
});
