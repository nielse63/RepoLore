import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Project, ScriptTarget, ts } from "ts-morph";
import { extractEntryPoints } from "../entry-points";

async function makeRootDir(pkg?: Record<string, unknown>): Promise<string> {
  const rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "repolore-entry-"));
  if (pkg) {
    await fsp.writeFile(
      path.join(rootDir, "package.json"),
      JSON.stringify(pkg)
    );
  }
  return rootDir;
}

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

describe("extractEntryPoints", () => {
  let rootDir: string;

  afterEach(async () => {
    if (rootDir) await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it('uses package.json "main" as a library entry point', async () => {
    rootDir = await makeRootDir({ main: "./src/index.js" });
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "src/index.js"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "library",
      location: { filePath: "src/index.js" },
      certainty: "detected",
    });
  });

  it('prefers the "exports" field over "main"/"module" when present', async () => {
    rootDir = await makeRootDir({
      main: "./src/legacy.js",
      exports: "./src/modern.js",
    });
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "src/legacy.js"), "");
    project.createSourceFile(path.join(rootDir, "src/modern.js"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    const filePaths = entryPoints.map((ep) => ep.location.filePath);
    expect(filePaths).toContain("src/modern.js");
    expect(entryPoints[0].id).toBe("js-ts-entry-package-exports");
  });

  it('resolves a conditions-object "exports" field via import/default', async () => {
    rootDir = await makeRootDir({
      exports: { ".": { types: "./index.d.ts", import: "./src/modern.js" } },
    });
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "src/modern.js"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints.map((ep) => ep.location.filePath)).toContain(
      "src/modern.js"
    );
  });

  it("adds a cli entry point for each declared bin command", async () => {
    rootDir = await makeRootDir({ bin: { mytool: "./bin/cli.js" } });
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "bin/cli.js"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "cli",
      id: "js-ts-entry-bin-mytool",
      location: { filePath: "bin/cli.js" },
    });
  });

  it("detects a bootstrap entry point via ReactDOM render/createRoot calls", async () => {
    rootDir = await makeRootDir();
    const project = makeProject();
    project.createSourceFile(
      path.join(rootDir, "src/main.tsx"),
      "import { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById('root')).render(<App />);"
    );

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "bootstrap",
      location: { filePath: "src/main.tsx" },
    });
  });

  it("does not treat a bare render() call in a test file as a bootstrap entry point", async () => {
    rootDir = await makeRootDir();
    const project = makeProject();
    project.createSourceFile(
      path.join(rootDir, "src/App.test.tsx"),
      "import { render } from '@testing-library/react';\nrender(<App />);"
    );

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toEqual([]);
  });

  it("falls back to a conventional index file when nothing else is found", async () => {
    rootDir = await makeRootDir();
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "src/index.ts"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toMatchObject({
      kind: "runtime",
      certainty: "inferred",
      location: { filePath: "src/index.ts" },
    });
  });

  it("returns no entry points when nothing matches any heuristic", async () => {
    rootDir = await makeRootDir();
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "src/util.ts"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toEqual([]);
  });

  it("does not double-claim a file already used by an earlier-priority heuristic", async () => {
    rootDir = await makeRootDir({ main: "./src/index.js" });
    const project = makeProject();
    project.createSourceFile(path.join(rootDir, "src/index.js"), "");

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toHaveLength(1);
  });
});
