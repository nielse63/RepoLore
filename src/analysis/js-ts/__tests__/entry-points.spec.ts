import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Project, ScriptTarget, ts } from "ts-morph";
import type { EntryPoint, Relationship } from "@/lore/model";
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

  it("does not treat a regex literal's '.test' call as a bootstrap render/createRoot match", async () => {
    rootDir = await makeRootDir();
    const project = makeProject();
    project.createSourceFile(
      path.join(rootDir, "src/detector.ts"),
      "function check(text: string) { return /\\.render$/.test(text) || /createRoot/.test(text); }"
    );

    const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

    expect(entryPoints).toEqual([]);
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

  describe("under a nested test directory (GitHub issue #65)", () => {
    const harness =
      "import ReactDOM from 'react-dom';\nReactDOM.render(<Harness />, document.body);";

    it("does not treat a test harness's render call as a bootstrap entry point", async () => {
      rootDir = await makeRootDir({ main: "packages/x/src/index.ts" });
      const project = makeProject();
      project.createSourceFile(
        path.join(rootDir, "packages/x/src/index.ts"),
        "export const x = 1;"
      );
      project.createSourceFile(
        path.join(rootDir, "packages/x/tests/run-harness.tsx"),
        harness
      );

      const entryPoints = extractEntryPoints(project.getSourceFiles(), rootDir);

      expect(entryPoints).toEqual([
        expect.objectContaining({
          kind: "library",
          location: { filePath: "packages/x/src/index.ts" },
        }),
      ]);
    });

    it("still detects it when production code imports from that directory", async () => {
      // A test-named directory imported by production code isn't a test
      // suite (e.g. a shipped `packages/test` helper package).
      rootDir = await makeRootDir();
      const project = makeProject();
      project.createSourceFile(
        path.join(rootDir, "packages/test/main.tsx"),
        harness
      );
      const productionImport: Relationship = {
        id: "rel",
        kind: "depends-on",
        fromId: "packages/core/src/compile.ts",
        toId: "packages/test/main.tsx",
        certainty: "detected",
        evidence: [],
      };

      const entryPoints = extractEntryPoints(
        project.getSourceFiles(),
        rootDir,
        [productionImport]
      );

      expect(entryPoints).toEqual([
        expect.objectContaining({
          kind: "bootstrap",
          location: { filePath: "packages/test/main.tsx" },
        }),
      ]);
    });
  });

  it("still detects it when a framework route sits in that directory", async () => {
    // Matches area grouping, where a non-test entry point (e.g. a Next.js
    // `app/test/page.tsx` route) means `app/test` isn't a test suite.
    rootDir = await makeRootDir();
    const project = makeProject();
    project.createSourceFile(
      path.join(rootDir, "app/test/main.tsx"),
      "import { createRoot } from 'react-dom/client';\ncreateRoot(el).render(<App />);"
    );
    const route: EntryPoint = {
      id: "route",
      kind: "framework",
      location: { filePath: "app/test/page.tsx" },
      certainty: "detected",
      evidence: [],
    };

    const entryPoints = extractEntryPoints(
      project.getSourceFiles(),
      rootDir,
      [],
      [route]
    );

    expect(entryPoints).toEqual([
      expect.objectContaining({
        kind: "bootstrap",
        location: { filePath: "app/test/main.tsx" },
      }),
    ]);
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
