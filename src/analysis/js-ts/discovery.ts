/**
 * JS/TS source file discovery: reads a project directly from local disk into
 * a ts-morph `Project`, applying exclusion rules (docs/architecture/decisions,
 * ADR-0003). This stays syntactic-only per ADR-0003 — no tsconfig-driven,
 * type-checked `Program` is constructed here; only enough compiler options
 * to parse `.ts`/`.tsx`/`.js`/`.jsx` ASTs.
 */

import path from "node:path";
import { Project, ScriptTarget, ts, type SourceFile } from "ts-morph";

/**
 * Directory names excluded from source discovery regardless of depth:
 * dependency, build/output, and version-control directories.
 */
export const EXCLUDED_DIRECTORY_NAMES = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  "coverage",
  ".git",
]);

const SOURCE_GLOB_EXTENSIONS = "{ts,tsx,js,jsx}";

/** True if any path segment is an excluded directory name. */
export function isExcludedPath(relativePath: string): boolean {
  const segments = relativePath.split(path.sep);
  return segments.some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment));
}

export interface DiscoveredProject {
  /** The ts-morph Project, containing only the discovered, non-excluded source files. */
  project: Project;
  sourceFiles: SourceFile[];
}

/**
 * Discovers JS/TS source files under `rootDir`, excluding
 * `EXCLUDED_DIRECTORY_NAMES` at any depth.
 */
export function discoverSourceFiles(rootDir: string): DiscoveredProject {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      target: ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    useInMemoryFileSystem: false,
  });

  const absoluteRoot = path.resolve(rootDir);
  const toPosix = (p: string) => p.split(path.sep).join("/");

  project.addSourceFilesAtPaths([
    toPosix(path.join(absoluteRoot, `**/*.${SOURCE_GLOB_EXTENSIONS}`)),
    ...[...EXCLUDED_DIRECTORY_NAMES].map(
      (dir) => `!${toPosix(path.join(absoluteRoot, "**", dir, "**"))}`,
    ),
  ]);

  // Defensive second pass: drop anything that slipped through the glob
  // negation (e.g. a symlink or a directory name matched only partially).
  for (const sourceFile of project.getSourceFiles()) {
    const relativePath = path.relative(absoluteRoot, sourceFile.getFilePath());
    if (isExcludedPath(relativePath)) {
      project.removeSourceFile(sourceFile);
    }
  }

  return { project, sourceFiles: project.getSourceFiles() };
}
