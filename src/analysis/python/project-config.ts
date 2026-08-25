/**
 * Reads Python project/package configuration: `pyproject.toml` (TOML,
 * `[project.scripts]`/`[project.gui-scripts]`/`[tool.poetry.scripts]`),
 * `setup.cfg` (INI, `[metadata] name` only — see the note below), and
 * `setup.py`'s `setup(...)` call, parsed syntactically via tree-sitter and
 * never executed (ADR-0006).
 */

import fs from "node:fs";
import path from "node:path";
import * as TOML from "smol-toml";
import * as ini from "ini";
import { createPythonParser, parsePythonSource } from "./parser";
import {
  descendantsOfType,
  directChildrenOfType,
  isStringLiteral,
  stringLiteralValue,
} from "./syntax";

export interface ConsoleScript {
  name: string;
  /** e.g. "pyapp.cli:main" — a dotted module path, a colon, then an attribute/function name. */
  target: string;
  sourceFile: string;
  configKey: string;
}

export type DeclaredDependencyScope = "direct" | "dev" | "optional";

export interface DeclaredDependency {
  name: string;
  versionSpec?: string;
  scope: DeclaredDependencyScope;
  sourceFile: string;
  configKey: string;
}

export interface PythonProjectConfig {
  name?: string;
  nameSourceFile?: string;
  nameConfigKey?: string;
  consoleScripts: ConsoleScript[];
  dependencies: DeclaredDependency[];
}

function emptyConfig(): PythonProjectConfig {
  return { consoleScripts: [], dependencies: [] };
}

/**
 * Splits a PEP 508 dependency specifier (`"requests[security]>=2.31,<3"`)
 * into its package name and the rest (extras + version specifier + any
 * environment marker), kept as one opaque display string rather than
 * further parsed — the MVP only needs to show it, not evaluate it.
 * Environment markers (after `;`) are intentionally left attached rather
 * than stripped, since a marker like `; python_version < "3.11"` is
 * meaningful context, not noise.
 */
function parsePep508(
  spec: string
): { name: string; rest?: string } | undefined {
  const match = spec.trim().match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(.*)$/);
  if (!match) return undefined;
  const [, name, rest] = match;
  return { name, rest: rest.trim() || undefined };
}

/** `[project.dependencies]` (a plain array of PEP 508 strings) and `[project.optional-dependencies]` (a table of group name -> array of PEP 508 strings). */
function readPep621Dependencies(parsed: unknown): DeclaredDependency[] {
  const dependencies: DeclaredDependency[] = [];

  const direct = getIn(parsed, ["project", "dependencies"]);
  if (Array.isArray(direct)) {
    for (const spec of direct) {
      if (typeof spec !== "string") continue;
      const parsedSpec = parsePep508(spec);
      if (!parsedSpec) continue;
      dependencies.push({
        name: parsedSpec.name,
        versionSpec: parsedSpec.rest,
        scope: "direct",
        sourceFile: "pyproject.toml",
        configKey: "project.dependencies",
      });
    }
  }

  const optionalGroups = getIn(parsed, ["project", "optional-dependencies"]);
  if (typeof optionalGroups === "object" && optionalGroups !== null) {
    for (const [group, specs] of Object.entries(
      optionalGroups as Record<string, unknown>
    )) {
      if (!Array.isArray(specs)) continue;
      for (const spec of specs) {
        if (typeof spec !== "string") continue;
        const parsedSpec = parsePep508(spec);
        if (!parsedSpec) continue;
        dependencies.push({
          name: parsedSpec.name,
          versionSpec: parsedSpec.rest,
          scope: "optional",
          sourceFile: "pyproject.toml",
          configKey: `project.optional-dependencies.${group}`,
        });
      }
    }
  }

  return dependencies;
}

/**
 * `[tool.poetry.dependencies]` (direct) and the legacy
 * `[tool.poetry.dev-dependencies]` (dev) tables — each maps a package name
 * to either a plain version-spec string (`"^2.31"`) or a table
 * (`{ version = "^2.31", ... }`). The modern per-group
 * `[tool.poetry.group.<name>.dependencies]` syntax is not read — a
 * disclosed, narrow scope decision matching this file's existing
 * `setup.cfg` console-script limitation, not an oversight.
 */
function readPoetryDependencies(parsed: unknown): DeclaredDependency[] {
  const dependencies: DeclaredDependency[] = [];

  const sections: Array<[string, DeclaredDependencyScope, string]> = [
    ["dependencies", "direct", "tool.poetry.dependencies"],
    ["dev-dependencies", "dev", "tool.poetry.dev-dependencies"],
  ];

  for (const [key, scope, configKeyPrefix] of sections) {
    const section = getIn(parsed, ["tool", "poetry", key]);
    if (typeof section !== "object" || section === null) continue;
    for (const [name, value] of Object.entries(
      section as Record<string, unknown>
    )) {
      if (name === "python") continue; // The interpreter constraint, not a dependency.
      let versionSpec: string | undefined;
      if (typeof value === "string") {
        versionSpec = value;
      } else if (typeof value === "object" && value !== null) {
        const version = (value as Record<string, unknown>).version;
        if (typeof version === "string") versionSpec = version;
      }
      dependencies.push({
        name,
        versionSpec,
        scope,
        sourceFile: "pyproject.toml",
        configKey: `${configKeyPrefix}.${name}`,
      });
    }
  }

  return dependencies;
}

function getIn(obj: unknown, keys: string[]): unknown {
  let current = obj;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readPyprojectToml(rootDir: string): PythonProjectConfig | undefined {
  const filePath = path.join(rootDir, "pyproject.toml");
  if (!fs.existsSync(filePath)) return undefined;

  let parsed: unknown;
  try {
    parsed = TOML.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }

  const config = emptyConfig();
  const name = getIn(parsed, ["project", "name"]);
  if (typeof name === "string") {
    config.name = name;
    config.nameSourceFile = "pyproject.toml";
    config.nameConfigKey = "project.name";
  }

  const scriptSections: Array<[string, unknown]> = [
    ["project.scripts", getIn(parsed, ["project", "scripts"])],
    ["project.gui-scripts", getIn(parsed, ["project", "gui-scripts"])],
    ["tool.poetry.scripts", getIn(parsed, ["tool", "poetry", "scripts"])],
  ];
  for (const [keyPrefix, section] of scriptSections) {
    if (typeof section !== "object" || section === null) continue;
    for (const [scriptName, target] of Object.entries(
      section as Record<string, unknown>
    )) {
      if (typeof target !== "string") continue;
      config.consoleScripts.push({
        name: scriptName,
        target,
        sourceFile: "pyproject.toml",
        configKey: `${keyPrefix}.${scriptName}`,
      });
    }
  }

  // PEP 621 `[project.dependencies]` takes precedence over Poetry's own
  // table for a given name when a pyproject.toml declares both (unusual,
  // but possible in a project mid-migration between the two).
  const seenDependencyNames = new Set<string>();
  for (const dep of [
    ...readPep621Dependencies(parsed),
    ...readPoetryDependencies(parsed),
  ]) {
    if (seenDependencyNames.has(dep.name)) continue;
    seenDependencyNames.add(dep.name);
    config.dependencies.push(dep);
  }

  return config;
}

/**
 * `setup.cfg`'s `[options.entry_points]` `console_scripts` conventionally
 * uses a multi-line, indented-continuation value — a configparser-specific
 * convention, not standard INI, that the `ini` npm package doesn't parse.
 * Only `[metadata] name` (a plain single-line key) is read from `setup.cfg`
 * in v1; console-script detection from this file is a disclosed limitation.
 */
function readSetupCfg(rootDir: string): PythonProjectConfig | undefined {
  const filePath = path.join(rootDir, "setup.cfg");
  if (!fs.existsSync(filePath)) return undefined;

  let parsed: unknown;
  try {
    parsed = ini.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return undefined;
  }

  const config = emptyConfig();
  const name = getIn(parsed, ["metadata", "name"]);
  if (typeof name === "string") {
    config.name = name;
    config.nameSourceFile = "setup.cfg";
    config.nameConfigKey = "metadata.name";
  }
  return config;
}

/**
 * Reads a top-level `setup(...)` call's `name` and `entry_points`
 * (`console_scripts`) keyword arguments by walking the parsed syntax tree —
 * `setup.py` is never executed, since it's untrusted repository content.
 */
async function readSetupPy(
  rootDir: string
): Promise<PythonProjectConfig | undefined> {
  const filePath = path.join(rootDir, "setup.py");
  if (!fs.existsSync(filePath)) return undefined;

  const parser = await createPythonParser();
  const tree = parsePythonSource(parser, fs.readFileSync(filePath, "utf-8"));

  const config = emptyConfig();
  const setupCall = descendantsOfType(tree.rootNode, "call").find((call) => {
    const fn = call.childForFieldName("function");
    return fn?.type === "identifier" && fn.text === "setup";
  });
  if (!setupCall) return config;

  const argumentsNode = setupCall.childForFieldName("arguments");
  if (!argumentsNode) return config;

  for (const kwarg of directChildrenOfType(argumentsNode, "keyword_argument")) {
    const nameNode = kwarg.childForFieldName("name");
    const valueNode = kwarg.childForFieldName("value");
    if (!nameNode || !valueNode) continue;

    if (nameNode.text === "name" && isStringLiteral(valueNode)) {
      config.name = stringLiteralValue(valueNode);
      config.nameSourceFile = "setup.py";
      config.nameConfigKey = "setup.name";
    }

    if (nameNode.text === "entry_points" && valueNode.type === "dictionary") {
      for (const pair of directChildrenOfType(valueNode, "pair")) {
        const keyNode = pair.childForFieldName("key");
        const valNode = pair.childForFieldName("value");
        if (!keyNode || !valNode) continue;
        if (!isStringLiteral(keyNode)) continue;
        if (stringLiteralValue(keyNode) !== "console_scripts") continue;
        if (valNode.type !== "list") continue;

        for (const item of valNode.namedChildren) {
          if (!item || !isStringLiteral(item)) continue;
          const raw = stringLiteralValue(item);
          const separatorIndex = raw.indexOf("=");
          if (separatorIndex === -1) continue;
          config.consoleScripts.push({
            name: raw.slice(0, separatorIndex).trim(),
            target: raw.slice(separatorIndex + 1).trim(),
            sourceFile: "setup.py",
            configKey: "setup.entry_points.console_scripts",
          });
        }
      }
    }
  }

  return config;
}

/**
 * Reads and merges Python project configuration from whichever of
 * `pyproject.toml`, `setup.cfg`, and `setup.py` are present. `pyproject.toml`
 * takes precedence for the project name when more than one declares it,
 * since it's the modern, standardized source; console scripts are unioned
 * across all sources that declare any.
 */
export async function readPythonProjectConfig(
  rootDir: string
): Promise<PythonProjectConfig> {
  const configs = [
    readPyprojectToml(rootDir),
    readSetupCfg(rootDir),
    await readSetupPy(rootDir),
  ].filter((c): c is PythonProjectConfig => c !== undefined);

  const merged = emptyConfig();
  for (const config of configs) {
    if (!merged.name && config.name) {
      merged.name = config.name;
      merged.nameSourceFile = config.nameSourceFile;
      merged.nameConfigKey = config.nameConfigKey;
    }
    merged.consoleScripts.push(...config.consoleScripts);
    merged.dependencies.push(...config.dependencies);
  }
  return merged;
}
