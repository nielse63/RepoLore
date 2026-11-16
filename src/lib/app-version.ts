import { execFileSync } from "node:child_process";
import { formatTag, latestVersion } from "./release-version";

/**
 * The most recent release when this was last updated. The footer never
 * shows anything older, so a build whose clone has no tags and no network
 * (Render's checkout has shown no tags) still shows a version. Bump it
 * alongside releases; a newer tag found at build time wins anyway.
 */
export const FALLBACK_APP_VERSION = "v0.1.0";

const REPO_GIT_URL = "https://github.com/nielse63/RepoLore.git";

/**
 * The most recent git tag reachable from the checked-out commit (e.g.
 * `v0.0.1`). `undefined` when git or any tag is unavailable (a shallow
 * clone without tags, no git binary).
 */
export function latestGitTag(): string | undefined {
  try {
    const tag = execFileSync("git", ["describe", "--tags", "--abbrev=0"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return tag || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Every tag on the public GitHub repository, read with `git ls-remote` so
 * it works without a local `.git` or its tags. Empty when git or the
 * network is unavailable.
 */
export function remoteGitTags(): string[] {
  try {
    return execFileSync(
      "git",
      ["ls-remote", "--tags", "--refs", REPO_GIT_URL],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 10_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      }
    )
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("refs/tags/")[1] ?? "");
  } catch {
    return [];
  }
}

/**
 * The app version shown in the site footer, read once at build time by
 * `next.config.ts`: the newest of the local tag, GitHub's tags, and
 * `FALLBACK_APP_VERSION`, so it is never empty.
 */
export function appVersion(): string {
  const tags = [latestGitTag(), ...remoteGitTags(), FALLBACK_APP_VERSION];
  return formatTag(
    latestVersion(tags.filter((tag): tag is string => tag !== undefined))!
  );
}
