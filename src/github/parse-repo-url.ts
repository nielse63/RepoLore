/**
 * Parses and normalizes user-pasted input into a GitHub `{ owner, repo }`
 * identity — the first step of the core user journey. Accepts the
 * shapes people actually paste — with or without a scheme, `www.`, a
 * trailing slash, a `.git` suffix, or extra path segments like `/tree/main`
 * — and rejects anything that isn't recognizably a github.com repository URL
 * with an honest, specific reason (acceptance criterion 2: no silent
 * failure). Ref/branch/path suffixes are intentionally ignored: the MVP
 * always analyzes the resolved default branch's HEAD commit, never a
 * user-specified ref.
 *
 * Also accepts bare `owner/repo` shorthand (no host at all, e.g.
 * `nielse63/RepoLore`) by rewriting it to a `github.com/...` URL up front
 * and falling through to the same validation as a full URL, rather than
 * duplicating owner/repo rules for a second input shape.
 */

export interface ParsedRepoUrl {
  owner: string;
  repo: string;
}

export type ParseRepoUrlResult =
  { ok: true; value: ParsedRepoUrl } | { ok: false; reason: string };

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]+$/;

const HAS_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

function withScheme(input: string): string {
  return HAS_SCHEME_PATTERN.test(input) ? input : `https://${input}`;
}

/**
 * True for bare `owner/repo` shorthand: exactly two `/`-separated segments,
 * no scheme, no `www.` prefix. The owner segment is required to contain no
 * `.` — real hostnames (`github.com`, `gitlab.com`, ...) always have one and
 * GitHub owner names never do, so this also keeps host-shaped input like
 * `github.com/owner` from being misread as shorthand.
 */
function isShorthandRepoRef(trimmed: string): boolean {
  if (HAS_SCHEME_PATTERN.test(trimmed) || /^www\./i.test(trimmed)) {
    return false;
  }
  const [owner, repo, ...rest] = trimmed.replace(/\/+$/, "").split("/");
  return Boolean(owner && repo && rest.length === 0 && !owner.includes("."));
}

export function parseGitHubRepoUrl(input: string): ParseRepoUrlResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "A GitHub URL is required." };
  }

  const candidate = isShorthandRepoRef(trimmed)
    ? `github.com/${trimmed}`
    : trimmed;

  let url: URL;
  try {
    url = new URL(withScheme(candidate));
  } catch {
    return { ok: false, reason: "That doesn’t look like a valid URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      ok: false,
      reason: "Only http(s) GitHub repository URLs are supported.",
    };
  }

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") {
    return {
      ok: false,
      reason: "Only github.com repository URLs are supported.",
    };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    return {
      ok: false,
      reason:
        "The URL must include an owner and repository name, e.g. github.com/owner/repo.",
    };
  }

  const [owner, rawRepo] = segments;
  const repo = rawRepo.endsWith(".git") ? rawRepo.slice(0, -4) : rawRepo;

  if (!OWNER_PATTERN.test(owner)) {
    return { ok: false, reason: `“${owner}” isn’t a valid GitHub owner name.` };
  }
  if (!repo || !REPO_PATTERN.test(repo)) {
    return {
      ok: false,
      reason: `“${rawRepo}” isn’t a valid GitHub repository name.`,
    };
  }

  return { ok: true, value: { owner, repo } };
}
