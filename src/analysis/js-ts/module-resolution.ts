/**
 * Resolves relative and alias-configured import/export specifiers to a
 * discovered ts-morph `SourceFile`, without constructing a type-checked
 * `Program` (ADR-0003). Relative specifiers ("./", "../") are resolved by
 * literal path-joining; alias specifiers are resolved against the
 * `PathAlias`es read by `project-config.ts` (tsconfig/jsconfig `paths`,
 * package.json `imports`, and common bundler/framework configs — ADR-0015).
 */

import path from "node:path";
import type {
  ExportDeclaration,
  ImportDeclaration,
  SourceFile,
} from "ts-morph";
import type { PathAlias } from "./project-config";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export interface ModuleResolutionIndex {
  resolve(
    fromAbsoluteFilePath: string,
    specifier: string
  ): SourceFile | undefined;
}

/** Tries the bare path, then each resolvable extension, then `index.{ext}` inside it as a directory. */
function resolveCandidates(
  byPath: Map<string, SourceFile>,
  base: string
): SourceFile | undefined {
  const candidates = [
    base,
    ...RESOLVABLE_EXTENSIONS.map((ext) => base + ext),
    ...RESOLVABLE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    const found = byPath.get(candidate);
    if (found) return found;
  }
  return undefined;
}

/** The longest-matching alias for `specifier` (aliases are pre-sorted longest-pattern-first), or undefined. */
export function matchAlias(
  specifier: string,
  aliases: PathAlias[]
): PathAlias | undefined {
  return aliases.find((alias) =>
    alias.matchType === "exact"
      ? specifier === alias.pattern
      : specifier.startsWith(alias.pattern)
  );
}

export function buildModuleResolutionIndex(
  sourceFiles: SourceFile[],
  rootDir: string,
  aliases: PathAlias[] = []
): ModuleResolutionIndex {
  const byPath = new Map<string, SourceFile>(
    sourceFiles.map((sf) => [sf.getFilePath(), sf])
  );

  function resolve(
    fromAbsoluteFilePath: string,
    specifier: string
  ): SourceFile | undefined {
    if (isRelativeSpecifier(specifier)) {
      const base = path.resolve(path.dirname(fromAbsoluteFilePath), specifier);
      return resolveCandidates(byPath, base);
    }

    const alias = matchAlias(specifier, aliases);
    if (!alias) return undefined;
    const rest = specifier.slice(alias.pattern.length);
    const base = path.resolve(rootDir, alias.target, rest);
    return resolveCandidates(byPath, base);
  }

  return { resolve };
}

export function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/**
 * `ts-morph` throws when asked for a module specifier's value if the
 * underlying node isn't a string literal — which happens for real on
 * malformed or non-standard source the TypeScript parser can't fully make
 * sense of (e.g. a syntax error inside an `import`/`export ... from` clause
 * recovered as an identifier or template literal instead of a quoted
 * string). That's unusual input, not grounds to abort the whole file's
 * analysis, so callers that don't need to distinguish "no specifier" from
 * "unreadable specifier" (unlike `imports.ts`, which records the latter as a
 * gap) can use this instead of calling `getModuleSpecifierValue()` directly.
 */
export function getModuleSpecifierValueSafe(
  decl: ImportDeclaration | ExportDeclaration
): string | undefined {
  try {
    return decl.getModuleSpecifierValue();
  } catch {
    return undefined;
  }
}

/** Heuristic for an unresolved path-alias-style specifier, e.g. "@/components/Header". */
export function looksLikePathAlias(specifier: string): boolean {
  return specifier.startsWith("@/");
}

/**
 * Extensions bundlers (webpack, Vite, CRA, ...) resolve as static assets,
 * not code — a relative import of one of these is never an internal
 * dependency edge, so failing to resolve it to a JS/TS source file is not an
 * analysis limitation worth surfacing as a gap. Found validating against a
 * real repository (`Adedoyin-Emmanuel/react-weather-app`) in implementation
 * session 6, which produced 68 "could not resolve" gaps for ordinary
 * `.svg`/`.png`/`.css` imports before this fix — none of them a real
 * limitation.
 */
const ASSET_EXTENSIONS = [
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp4",
  ".mp3",
  ".wav",
  ".webm",
  ".pdf",
];

export function looksLikeAssetImport(specifier: string): boolean {
  const lower = specifier.toLowerCase();
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
