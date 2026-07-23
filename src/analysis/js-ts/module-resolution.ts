/**
 * Resolves relative import/export specifiers to a discovered ts-morph
 * `SourceFile`, without constructing a type-checked `Program` (ADR-0003).
 * Only relative specifiers ("./", "../") are handled here; path-alias
 * resolution (e.g. tsconfig `paths`) is deferred to implementation session 6.
 */

import path from 'node:path';
import type { SourceFile } from 'ts-morph';

const RESOLVABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

export interface ModuleResolutionIndex {
  resolve(
    fromAbsoluteFilePath: string,
    specifier: string
  ): SourceFile | undefined;
}

export function buildModuleResolutionIndex(
  sourceFiles: SourceFile[]
): ModuleResolutionIndex {
  const byPath = new Map<string, SourceFile>(
    sourceFiles.map((sf) => [sf.getFilePath(), sf])
  );

  function resolve(
    fromAbsoluteFilePath: string,
    specifier: string
  ): SourceFile | undefined {
    const base = path.resolve(path.dirname(fromAbsoluteFilePath), specifier);
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

  return { resolve };
}

export function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/** Heuristic for an unresolved path-alias-style specifier, e.g. "@/components/Header". */
export function looksLikePathAlias(specifier: string): boolean {
  return specifier.startsWith('@/');
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
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp4',
  '.mp3',
  '.wav',
  '.webm',
  '.pdf',
];

export function looksLikeAssetImport(specifier: string): boolean {
  const lower = specifier.toLowerCase();
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
