/**
 * Python source file discovery: walks a directory on local disk, applying
 * exclusion rules (ADR-0006), and parses every discovered `.py` file into a
 * tree-sitter concrete syntax tree.
 */

import fs from "node:fs";
import path from "node:path";
import type { Tree } from "web-tree-sitter";
import { createPythonParser, parsePythonSource } from "./parser";

/**
 * Directory names excluded from source discovery regardless of depth:
 * bytecode caches, virtual environments, installed/vendored packages,
 * build/output, tool caches, and version-control directories.
 */
export const EXCLUDED_DIRECTORY_NAMES = new Set([
  "__pycache__",
  ".venv",
  "venv",
  "env",
  ".tox",
  ".eggs",
  "build",
  "dist",
  ".git",
  "site-packages",
  ".mypy_cache",
  ".pytest_cache",
  ".ipynb_checkpoints",
  "node_modules",
]);

/**
 * True if a directory name is excluded — either an exact match, or a
 * `*.egg-info` directory (its name varies per package, so it can't be an
 * exact-match set entry).
 */
export function isExcludedDirectoryName(name: string): boolean {
  return EXCLUDED_DIRECTORY_NAMES.has(name) || name.endsWith(".egg-info");
}

/** True if any path segment is an excluded directory name. */
export function isExcludedPath(relativePath: string): boolean {
  return relativePath
    .split("/")
    .some((segment) => isExcludedDirectoryName(segment));
}

export interface PythonSourceFile {
  absolutePath: string;
  /** Repo-root-relative, posix-separated path, e.g. "src/pyapp/core.py". */
  relativePath: string;
  sourceText: string;
  tree: Tree;
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (isExcludedDirectoryName(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name.endsWith(".py")) {
      out.push(path.join(dir, entry.name));
    }
  }
}

/**
 * Discovers Python source files under `rootDir`, excluding
 * `EXCLUDED_DIRECTORY_NAMES` at any depth, and parses each with
 * tree-sitter-python.
 */
export async function discoverSourceFiles(
  rootDir: string
): Promise<PythonSourceFile[]> {
  const absoluteRoot = path.resolve(rootDir);
  const absolutePaths: string[] = [];
  walk(absoluteRoot, absolutePaths);

  const parser = await createPythonParser();

  return absolutePaths
    .map((absolutePath) => {
      const relativePath = path
        .relative(absoluteRoot, absolutePath)
        .split(path.sep)
        .join("/");
      const sourceText = fs.readFileSync(absolutePath, "utf-8");
      const tree = parsePythonSource(parser, sourceText);
      return { absolutePath, relativePath, sourceText, tree };
    })
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
