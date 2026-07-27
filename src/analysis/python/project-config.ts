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

export interface PythonProjectConfig {
  name?: string;
  nameSourceFile?: string;
  nameConfigKey?: string;
  consoleScripts: ConsoleScript[];
}

function emptyConfig(): PythonProjectConfig {
  return { consoleScripts: [] };
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
  }
  return merged;
}
