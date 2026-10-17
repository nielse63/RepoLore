import {
  parseGitHubRepoUrl,
  type ParsedRepoUrl,
} from "@/github/parse-repo-url";

/**
 * First path segments that are this app's own routes, so a path under them
 * that no route matched (e.g. `/lore/x`) 404s rather than being read as a
 * GitHub owner.
 */
const RESERVED_OWNERS = new Set(["lore", "explore", "api", "_next"]);

/**
 * The repository a "swapped" URL names: someone replaced `github.com` with
 * this site's host (`/vercel/next.js/tree/canary` → `vercel/next.js`), or
 * prefixed it (`/github.com/vercel/next.js`). Trailing ref/path segments are
 * ignored, like a pasted URL's are (`parseGitHubRepoUrl`). `null` for
 * anything that isn't a valid owner/repo.
 */
export function repoFromSwappedPath(segments: string[]): ParsedRepoUrl | null {
  let decoded: string[];
  try {
    decoded = segments.map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const first = decoded[0]?.toLowerCase();
  if (!first || RESERVED_OWNERS.has(first)) return null;

  const hasHost = first === "github.com" || first === "www.github.com";
  const path = hasHost ? decoded.slice(1) : decoded;
  if (path.length < 2) return null;

  const parsed = parseGitHubRepoUrl(`https://github.com/${path.join("/")}`);
  return parsed.ok ? parsed.value : null;
}
