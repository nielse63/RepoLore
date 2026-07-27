import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readPythonProjectConfig } from "../project-config";

async function makeRootDir(): Promise<string> {
  return fsp.mkdtemp(path.join(os.tmpdir(), "repolore-py-config-"));
}

describe("readPythonProjectConfig", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await makeRootDir();
  });

  afterEach(async () => {
    await fsp.rm(rootDir, { recursive: true, force: true });
  });

  it("reads the project name and console scripts from pyproject.toml", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      `
[project]
name = "myapp"

[project.scripts]
mycli = "myapp.cli:main"
`
    );

    const config = await readPythonProjectConfig(rootDir);

    expect(config.name).toBe("myapp");
    expect(config.nameSourceFile).toBe("pyproject.toml");
    expect(config.nameConfigKey).toBe("project.name");
    expect(config.consoleScripts).toEqual([
      {
        name: "mycli",
        target: "myapp.cli:main",
        sourceFile: "pyproject.toml",
        configKey: "project.scripts.mycli",
      },
    ]);
  });

  it("reads gui-scripts and tool.poetry.scripts sections", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      `
[project]
name = "myapp"

[project.gui-scripts]
mygui = "myapp.gui:main"

[tool.poetry.scripts]
poetrycli = "myapp.poetry_cli:main"
`
    );

    const config = await readPythonProjectConfig(rootDir);
    const names = config.consoleScripts.map((s) => s.name).sort();
    expect(names).toEqual(["mygui", "poetrycli"]);
  });

  it("returns an empty config when pyproject.toml fails to parse", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      "[[[not valid toml"
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.name).toBeUndefined();
    expect(config.consoleScripts).toEqual([]);
  });

  it("reads the project name from setup.cfg [metadata] when no pyproject.toml is present", async () => {
    await fsp.writeFile(
      path.join(rootDir, "setup.cfg"),
      "[metadata]\nname = cfgapp\n"
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.name).toBe("cfgapp");
    expect(config.nameSourceFile).toBe("setup.cfg");
    expect(config.nameConfigKey).toBe("metadata.name");
  });

  it("prefers pyproject.toml's name over setup.cfg's when both are present", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      '[project]\nname = "tomlapp"\n'
    );
    await fsp.writeFile(
      path.join(rootDir, "setup.cfg"),
      "[metadata]\nname = cfgapp\n"
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.name).toBe("tomlapp");
  });

  it("reads name and console_scripts entry_points from a setup.py setup() call", async () => {
    await fsp.writeFile(
      path.join(rootDir, "setup.py"),
      `
from setuptools import setup

setup(
    name="setuppyapp",
    entry_points={
        "console_scripts": [
            "setupcli=setuppyapp.cli:main",
        ],
    },
)
`
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.name).toBe("setuppyapp");
    expect(config.nameSourceFile).toBe("setup.py");
    expect(config.consoleScripts).toEqual([
      {
        name: "setupcli",
        target: "setuppyapp.cli:main",
        sourceFile: "setup.py",
        configKey: "setup.entry_points.console_scripts",
      },
    ]);
  });

  it("unions console scripts across multiple config sources", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      '[project.scripts]\ntomlcli = "app.cli:main"\n'
    );
    await fsp.writeFile(
      path.join(rootDir, "setup.py"),
      `
setup(
    entry_points={"console_scripts": ["setupcli=app.cli2:main"]},
)
`
    );

    const config = await readPythonProjectConfig(rootDir);
    const names = config.consoleScripts.map((s) => s.name).sort();
    expect(names).toEqual(["setupcli", "tomlcli"]);
  });

  it("returns an entirely empty config when no config files are present", async () => {
    const config = await readPythonProjectConfig(rootDir);
    expect(config).toEqual({ consoleScripts: [] });
  });
});
