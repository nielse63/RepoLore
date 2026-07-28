import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractJsTsProject } from "../extract-project";

async function makeFixture(files: Record<string, string>): Promise<string> {
  const rootDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "repolore-extract-")
  );
  for (const [relPath, content] of Object.entries(files)) {
    const dest = path.join(rootDir, relPath);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, content);
  }
  return rootDir;
}

describe("extractJsTsProject", () => {
  let rootDir: string;

  afterEach(async () => {
    if (rootDir) await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("extracts a project name from package.json when present", async () => {
    rootDir = await makeFixture({
      "package.json": JSON.stringify({
        name: "my-app",
        main: "./src/index.js",
      }),
      "src/index.js": "module.exports = {};",
    });

    const result = extractJsTsProject(rootDir);
    expect(result.project.name).toBe("my-app");
    expect(result.project.kind).toBe("library");
  });

  it("falls back to the directory basename when there is no package.json", async () => {
    rootDir = await makeFixture({ "src/index.ts": "export const x = 1;" });

    const result = extractJsTsProject(rootDir);
    expect(result.project.name).toBe(path.basename(rootDir));
  });

  it("infers an application kind from a bootstrap entry point", async () => {
    rootDir = await makeFixture({
      "src/main.tsx":
        "import { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById('root')).render(<App />);",
    });

    const result = extractJsTsProject(rootDir);
    expect(result.project.kind).toBe("application");
  });

  it("does not treat a fixture app's bootstrap call as the project's real entry point", async () => {
    rootDir = await makeFixture({
      "src/lib.ts": "export const x = 1;",
      "fixtures/ts-react-app/src/index.tsx":
        "import { createRoot } from 'react-dom/client';\ncreateRoot(document.getElementById('root')).render(<App />);",
    });

    const result = extractJsTsProject(rootDir);
    expect(result.sourceFilePaths).not.toContain(
      "fixtures/ts-react-app/src/index.tsx"
    );
    expect(result.entryPoints).toEqual([]);
    expect(result.project.kind).not.toBe("application");
  });

  it("detects React components and adds the react framework tag", async () => {
    rootDir = await makeFixture({
      "src/Header.tsx": "export function Header() { return <div>hi</div>; }",
    });

    const result = extractJsTsProject(rootDir);
    expect(result.project.frameworks).toContain("react");
    expect(result.reactComponents).toHaveLength(1);
  });

  it("aggregates relationships, entry points, public contracts, and test relationships", async () => {
    rootDir = await makeFixture({
      "package.json": JSON.stringify({ main: "./src/index.ts" }),
      "src/index.ts": "export { add } from './math';",
      "src/math.ts": "export const add = (a: number, b: number) => a + b;",
      "src/math.test.ts": "import { add } from './math';",
    });

    const result = extractJsTsProject(rootDir);

    expect(result.sourceFilePaths.sort()).toEqual([
      "src/index.ts",
      "src/math.test.ts",
      "src/math.ts",
    ]);
    expect(result.relationships).toHaveLength(2);
    expect(result.entryPoints).toHaveLength(1);
    expect(result.publicContracts.map((c) => c.name)).toEqual(["add"]);
    expect(result.testRelationships).toHaveLength(1);
  });

  it("collects gaps from import and test extraction", async () => {
    rootDir = await makeFixture({
      "src/index.ts": "import { thing } from './missing';",
    });

    const result = extractJsTsProject(rootDir);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it("detects typescript and javascript languages from discovered file extensions", async () => {
    rootDir = await makeFixture({
      "src/index.ts": "",
      "src/legacy.js": "",
    });

    const result = extractJsTsProject(rootDir);
    expect(result.project.languages.sort()).toEqual([
      "javascript",
      "typescript",
    ]);
  });

  it("uses the provided projectId", async () => {
    rootDir = await makeFixture({ "src/index.ts": "" });
    const result = extractJsTsProject(rootDir, "custom-id");
    expect(result.project.id).toBe("custom-id");
  });
});
