import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractPythonProject } from "../extract-project";

async function makeFixture(files: Record<string, string>): Promise<string> {
  const rootDir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "repolore-py-extract-")
  );
  for (const [relPath, content] of Object.entries(files)) {
    const dest = path.join(rootDir, relPath);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.writeFile(dest, content);
  }
  return rootDir;
}

describe("extractPythonProject", () => {
  let rootDir: string;

  afterEach(async () => {
    if (rootDir) await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("uses the pyproject.toml-declared name for the project", async () => {
    rootDir = await makeFixture({
      "pyproject.toml": '[project]\nname = "myapp"\n',
      "myapp/__init__.py": "",
    });

    const result = await extractPythonProject(rootDir);
    expect(result.project.name).toBe("myapp");
    expect(result.project.languages).toEqual(["python"]);
  });

  it("falls back to the directory basename when there is no declared name", async () => {
    rootDir = await makeFixture({ "main.py": "" });

    const result = await extractPythonProject(rootDir);
    expect(result.project.name).toBe(path.basename(rootDir));
  });

  it("infers an application kind from a bootstrap entry point", async () => {
    rootDir = await makeFixture({
      "app.py": 'if __name__ == "__main__":\n    print("hi")\n',
    });

    const result = await extractPythonProject(rootDir);
    expect(result.project.kind).toBe("application");
  });

  it("infers a library kind from a resolved package entry point", async () => {
    rootDir = await makeFixture({
      "pyproject.toml": '[project]\nname = "myapp"\n',
      "myapp/__init__.py": "def foo():\n    pass\n",
    });

    const result = await extractPythonProject(rootDir);
    expect(result.project.kind).toBe("library");
  });

  it("aggregates relationships, entry points, public contracts, and test relationships", async () => {
    rootDir = await makeFixture({
      "pyproject.toml": '[project]\nname = "myapp"\n',
      "myapp/__init__.py": "from myapp.core import add\n",
      "myapp/core.py": "def add(a, b):\n    return a + b\n",
      "myapp/test_core.py": "from myapp.core import add\n",
    });

    const result = await extractPythonProject(rootDir);

    expect(result.sourceFilePaths.sort()).toEqual([
      "myapp/__init__.py",
      "myapp/core.py",
      "myapp/test_core.py",
    ]);
    expect(result.relationships.length).toBeGreaterThan(0);
    expect(result.entryPoints).toHaveLength(1);
    expect(result.publicContracts.map((c) => c.name)).toEqual(["add"]);
    expect(result.testRelationships).toHaveLength(1);
  });

  it("collects gaps from import and test extraction", async () => {
    rootDir = await makeFixture({
      "app.py": "from .missing import x\n",
    });

    const result = await extractPythonProject(rootDir);
    expect(result.gaps.length).toBeGreaterThan(0);
  });

  it("uses the provided projectId", async () => {
    rootDir = await makeFixture({ "main.py": "" });
    const result = await extractPythonProject(rootDir, "custom-id");
    expect(result.project.id).toBe("custom-id");
  });
});
