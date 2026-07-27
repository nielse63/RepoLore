/**
 * Resolves Python import specifiers (absolute dotted paths and explicit
 * relative imports) to a discovered source file, without executing any
 * repository code (ADR-0006).
 *
 * Absolute imports (`import foo.bar`, `from foo.bar import baz`) are
 * resolved against detected source roots — the repository root itself, plus
 * a top-level `src/` directory when present (the conventional layout
 * `docs/product/mvp.md` calls out). Relative imports (`from . import x`,
 * `from .foo import bar`, `from ..pkg import x`) are resolved directly
 * against the importing file's own package directory, walking up one
 * directory per additional leading dot.
 *
 * Unlike JS/TS's bare specifiers, an *absolute* Python import that doesn't
 * resolve to a discovered file is not recorded as a gap: `import os` and
 * `import requests` have exactly the same dotted-path shape as a genuine
 * internal import, so a miss there is overwhelmingly a standard-library or
 * third-party package, not an analysis limitation. A *relative* import is
 * unambiguously intra-project, so a miss there is a real gap (see
 * `./imports.ts`).
 *
 * A `from x.y import z` (or `from .x import z`) statement is ambiguous
 * between "z is a submodule of x.y" and "z is an attribute/name defined
 * inside x.y" — both are common. Callers resolve this by trying the
 * submodule shape first (`resolveUnderBase(base, [...module, z])`) and
 * falling back to the module itself (`resolveUnderBase(base, module)`).
 */

import fs from "node:fs";
import path from "node:path";
import type { PythonSourceFile } from "./discovery";

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Source roots to try, most specific first: `src/` (if present), then the repository root. */
export function detectSourceRoots(rootDir: string): string[] {
  const absoluteRoot = path.resolve(rootDir);
  const roots = [absoluteRoot];
  const srcDir = path.join(absoluteRoot, "src");
  if (isDirectory(srcDir)) roots.unshift(srcDir);
  return roots;
}

/** The absolute directory `level` dots away from `fromFile` (level=1 is its own package). */
export function relativeBaseDir(
  fromFile: PythonSourceFile,
  level: number
): string {
  let base = path.dirname(fromFile.absolutePath);
  for (let i = 1; i < level; i++) {
    base = path.dirname(base);
  }
  return base;
}

export interface PythonModuleResolutionIndex {
  /** Resolves an absolute dotted module path (e.g. `["foo", "bar"]`) against detected source roots. */
  resolveUnderRoots(segments: string[]): PythonSourceFile | undefined;
  /** Resolves a dotted module path directly under an already-computed absolute base directory. */
  resolveUnderBase(
    baseAbsoluteDir: string,
    segments: string[]
  ): PythonSourceFile | undefined;
}

export function buildModuleResolutionIndex(
  sourceFiles: PythonSourceFile[],
  rootDir: string
): PythonModuleResolutionIndex {
  const absoluteRoot = path.resolve(rootDir);
  const roots = detectSourceRoots(absoluteRoot);
  const byRelativePath = new Map(
    sourceFiles.map((sf) => [sf.relativePath, sf])
  );

  function resolveUnderBase(
    baseAbsoluteDir: string,
    segments: string[]
  ): PythonSourceFile | undefined {
    if (segments.length === 0) return undefined;
    const candidateBase = path.join(baseAbsoluteDir, ...segments);
    const moduleFile = `${candidateBase}.py`;
    const packageInit = path.join(candidateBase, "__init__.py");
    for (const candidate of [moduleFile, packageInit]) {
      const relative = path
        .relative(absoluteRoot, candidate)
        .split(path.sep)
        .join("/");
      const found = byRelativePath.get(relative);
      if (found) return found;
    }
    return undefined;
  }

  function resolveUnderRoots(segments: string[]): PythonSourceFile | undefined {
    for (const root of roots) {
      const found = resolveUnderBase(root, segments);
      if (found) return found;
    }
    return undefined;
  }

  return { resolveUnderRoots, resolveUnderBase };
}
