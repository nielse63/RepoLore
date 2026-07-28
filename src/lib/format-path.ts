/**
 * Renders a repository-relative path with a leading "/" for display, e.g.
 * "src/index.ts" -> "/src/index.ts". The root directory sentinel "." (as
 * used by `StructuralArea.location.filePath`/`Project.rootPath`) becomes
 * "/" rather than "/.". Display-only — never apply to a path used to build
 * a GitHub URL (`src/github/urls.ts` already handles those separately).
 */
export function formatPath(path: string): string {
  if (path === ".") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}
