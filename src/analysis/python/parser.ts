/**
 * Shared tree-sitter-python setup (ADR-0006): a syntactic-only concrete
 * syntax tree, via `web-tree-sitter`'s pure WASM runtime and the
 * `tree-sitter-python` package's prebuilt `.wasm` grammar — no native
 * compilation and no system Python interpreter required at runtime.
 */

import path from "node:path";
import { createRequire } from "node:module";
import { Parser, Language, type Tree } from "web-tree-sitter";

let initPromise: Promise<void> | undefined;
let pythonLanguage: Language | undefined;

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = Parser.init();
  }
  await initPromise;
}

async function loadPythonLanguage(): Promise<Language> {
  if (pythonLanguage) return pythonLanguage;
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("tree-sitter-python/package.json");
  const wasmPath = path.join(
    path.dirname(packageJsonPath),
    "tree-sitter-python.wasm"
  );
  pythonLanguage = await Language.load(wasmPath);
  return pythonLanguage;
}

/** A fresh parser instance with the Python grammar loaded, ready to `.parse()`. */
export async function createPythonParser(): Promise<Parser> {
  await ensureInitialized();
  const language = await loadPythonLanguage();
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export function parsePythonSource(parser: Parser, sourceText: string): Tree {
  const tree = parser.parse(sourceText);
  if (!tree) {
    throw new Error("tree-sitter-python failed to parse source text");
  }
  return tree;
}
