/**
 * Shared tree-sitter-python setup (ADR-0006): a syntactic-only concrete
 * syntax tree, via `web-tree-sitter`'s pure WASM runtime and the
 * `tree-sitter-python` package's prebuilt `.wasm` grammar — no native
 * compilation and no system Python interpreter required at runtime.
 */

import path from "node:path";
import { Parser, Language, type Tree } from "web-tree-sitter";

let initPromise: Promise<void> | undefined;
let pythonLanguage: Language | undefined;

/**
 * Both wasm binaries are located relative to `process.cwd()`'s
 * `node_modules` rather than via `require.resolve` (the original, more
 * conventional approach). Under Next.js's Turbopack bundler,
 * `require.resolve` calls get rewritten into Turbopack's own internal
 * module representation (a numeric id at build time, an unreadable virtual
 * `[project]/...`/`[externals]/...` string at request time) instead of a
 * real, filesystem-readable absolute path — found wiring the Python
 * analyzer into a real page route in implementation session 13, and
 * confirmed to reproduce identically whether or not the packages are
 * marked external (`next.config.ts`). `process.cwd()`-relative
 * construction isn't touched by that rewriting since it isn't a module
 * resolution call. This assumes a flat `node_modules` layout (true here —
 * a single Next.js deployable, ADR-0001, no workspaces/monorepo).
 */
function nodeModulesPath(...segments: string[]): string {
  return path.join(process.cwd(), "node_modules", ...segments);
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    const wasmDirectory = nodeModulesPath("web-tree-sitter");
    initPromise = Parser.init({
      locateFile: (scriptName: string) => path.join(wasmDirectory, scriptName),
    });
  }
  await initPromise;
}

async function loadPythonLanguage(): Promise<Language> {
  if (pythonLanguage) return pythonLanguage;
  const wasmPath = nodeModulesPath(
    "tree-sitter-python",
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
