import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverSourceFiles, isExcludedPath } from "../discovery";

describe("isExcludedPath", () => {
  it("is true when any path segment matches an excluded directory name", () => {
    expect(isExcludedPath(path.join("node_modules", "foo", "index.js"))).toBe(
      true
    );
    expect(isExcludedPath(path.join("src", "dist", "bundle.js"))).toBe(true);
  });

  it("is false for ordinary source paths", () => {
    expect(isExcludedPath(path.join("src", "index.ts"))).toBe(false);
  });
});

describe("discoverSourceFiles", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "repolore-discovery-"));
  });

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("discovers .ts/.tsx/.js/.jsx files under the root", async () => {
    await fsp.mkdir(path.join(rootDir, "src"), { recursive: true });
    await fsp.writeFile(path.join(rootDir, "src/index.ts"), "");
    await fsp.writeFile(path.join(rootDir, "src/App.tsx"), "");
    await fsp.writeFile(path.join(rootDir, "src/legacy.js"), "");
    await fsp.writeFile(path.join(rootDir, "src/Widget.jsx"), "");
    await fsp.writeFile(path.join(rootDir, "README.md"), "");

    const { sourceFiles } = discoverSourceFiles(rootDir);
    const relativePaths = sourceFiles
      .map((sf) => path.relative(rootDir, sf.getFilePath()))
      .sort();

    expect(relativePaths).toEqual([
      "src/App.tsx",
      "src/Widget.jsx",
      "src/index.ts",
      "src/legacy.js",
    ]);
  });

  it("excludes node_modules, dist, build, out, .next, coverage, and .git directories", async () => {
    await fsp.mkdir(path.join(rootDir, "src"), { recursive: true });
    await fsp.writeFile(path.join(rootDir, "src/index.ts"), "");

    for (const dir of [
      "node_modules",
      "dist",
      "build",
      "out",
      ".next",
      "coverage",
    ]) {
      await fsp.mkdir(path.join(rootDir, dir), { recursive: true });
      await fsp.writeFile(path.join(rootDir, dir, "ignored.ts"), "");
    }

    const { sourceFiles } = discoverSourceFiles(rootDir);
    const relativePaths = sourceFiles.map((sf) =>
      path.relative(rootDir, sf.getFilePath())
    );

    expect(relativePaths).toEqual(["src/index.ts"]);
  });

  it("excludes nested occurrences of excluded directory names", async () => {
    await fsp.mkdir(path.join(rootDir, "packages/app/node_modules/dep"), {
      recursive: true,
    });
    await fsp.writeFile(
      path.join(rootDir, "packages/app/node_modules/dep/index.ts"),
      ""
    );
    await fsp.mkdir(path.join(rootDir, "packages/app/src"), {
      recursive: true,
    });
    await fsp.writeFile(path.join(rootDir, "packages/app/src/index.ts"), "");

    const { sourceFiles } = discoverSourceFiles(rootDir);
    const relativePaths = sourceFiles.map((sf) =>
      path.relative(rootDir, sf.getFilePath())
    );

    expect(relativePaths).toEqual(["packages/app/src/index.ts"]);
  });

  it("returns an empty project for a directory with no matching source files", async () => {
    await fsp.writeFile(path.join(rootDir, "README.md"), "");

    const { sourceFiles } = discoverSourceFiles(rootDir);
    expect(sourceFiles).toEqual([]);
  });
});
