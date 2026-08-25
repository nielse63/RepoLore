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
    expect(config).toEqual({ consoleScripts: [], dependencies: [] });
  });

  it("reads PEP 621 [project.dependencies] and [project.optional-dependencies]", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      `
[project]
name = "myapp"
dependencies = [
  "requests>=2.31,<3",
  "click",
]

[project.optional-dependencies]
dev = ["pytest>=7.0"]
`
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.dependencies).toEqual([
      {
        name: "requests",
        versionSpec: ">=2.31,<3",
        scope: "direct",
        sourceFile: "pyproject.toml",
        configKey: "project.dependencies",
      },
      {
        name: "click",
        versionSpec: undefined,
        scope: "direct",
        sourceFile: "pyproject.toml",
        configKey: "project.dependencies",
      },
      {
        name: "pytest",
        versionSpec: ">=7.0",
        scope: "optional",
        sourceFile: "pyproject.toml",
        configKey: "project.optional-dependencies.dev",
      },
    ]);
  });

  it("reads [tool.poetry.dependencies] (string and table form) and [tool.poetry.dev-dependencies], skipping the python key", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      `
[tool.poetry.dependencies]
python = "^3.11"
requests = "^2.31"
rich = { version = "^13.0", extras = ["jupyter"] }

[tool.poetry.dev-dependencies]
pytest = "^7.0"
`
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.dependencies).toEqual([
      {
        name: "requests",
        versionSpec: "^2.31",
        scope: "direct",
        sourceFile: "pyproject.toml",
        configKey: "tool.poetry.dependencies.requests",
      },
      {
        name: "rich",
        versionSpec: "^13.0",
        scope: "direct",
        sourceFile: "pyproject.toml",
        configKey: "tool.poetry.dependencies.rich",
      },
      {
        name: "pytest",
        versionSpec: "^7.0",
        scope: "dev",
        sourceFile: "pyproject.toml",
        configKey: "tool.poetry.dev-dependencies.pytest",
      },
    ]);
  });

  it("prefers PEP 621 over Poetry for a name declared in both", async () => {
    await fsp.writeFile(
      path.join(rootDir, "pyproject.toml"),
      `
[project]
dependencies = ["requests>=2.31"]

[tool.poetry.dependencies]
requests = "^2.0"
`
    );

    const config = await readPythonProjectConfig(rootDir);
    expect(config.dependencies).toHaveLength(1);
    expect(config.dependencies[0].versionSpec).toBe(">=2.31");
  });
});
