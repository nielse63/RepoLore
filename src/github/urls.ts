import type { SourceLocation } from '@/lore/model';

/** A GitHub blob (file) URL for a source location, pinned to the exact analyzed commit. */
export function githubBlobUrl(
  owner: string,
  repo: string,
  commitSha: string,
  location: SourceLocation
): string {
  const base = `https://github.com/${owner}/${repo}/blob/${commitSha}/${location.filePath}`;
  return location.startLine ? `${base}#L${location.startLine}` : base;
}

/**
 * A GitHub tree (directory) URL, pinned to the exact analyzed commit —
 * `StructuralArea.location` names a directory grouping, not a file, so it
 * needs `/tree/`, not `/blob/`. `filePath: '.'` (the project root) omits
 * the path segment entirely rather than linking to a literal `/tree/{sha}/.`.
 */
export function githubTreeUrl(
  owner: string,
  repo: string,
  commitSha: string,
  location: SourceLocation
): string {
  const path = location.filePath === '.' ? '' : `/${location.filePath}`;
  return `https://github.com/${owner}/${repo}/tree/${commitSha}${path}`;
}
