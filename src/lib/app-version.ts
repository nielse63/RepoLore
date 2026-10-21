import { execFileSync } from "node:child_process";

/**
 * The most recent git tag reachable from the checked-out commit (e.g.
 * `v0.0.1`), read once at build time by `next.config.ts` and shown in the
 * site footer. `undefined` when git or any tag is unavailable (a shallow
 * clone without tags, no git binary), so the footer simply omits it.
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
