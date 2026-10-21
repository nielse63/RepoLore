/**
 * Creates a GitHub release, and with it a new `vX.Y.Z` tag, on `main` (or
 * `--target`). The footer's version is the latest tag at build time
 * (`src/lib/app-version.ts`), so this is how a version reaches the site.
 * `.github/workflows/release.yml` runs this with `--patch` whenever `dev`
 * is merged into `main`; run it by hand for minor/major/explicit versions.
 *
 * Usage:
 *   npm run release -- --patch | --minor | --major
 *   npm run release -- --version 1.2.3
 * Options:
 *   --target <ref>  branch or commit SHA to tag on GitHub (default: main)
 *   --dry-run       print the next tag without creating anything
 *   --yes           skip the confirmation prompt
 *
 * The latest tag is read from origin (not local tags), and GitHub creates
 * the tag at the target's tip there, so the local checkout doesn't matter.
 * Requires the `gh` CLI, authenticated with push access.
 */

import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import {
  formatTag,
  latestVersion,
  nextTag,
  type Bump,
} from "../src/lib/release-version";

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function remoteTags(): string[] {
  return run("git", ["ls-remote", "--tags", "--refs", "origin"])
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("refs/tags/")[1]);
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test(await rl.question(`${question} [y/N] `));
  } finally {
    rl.close();
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      major: { type: "boolean" },
      minor: { type: "boolean" },
      patch: { type: "boolean" },
      version: { type: "string" },
      target: { type: "string", default: "main" },
      "dry-run": { type: "boolean" },
      yes: { type: "boolean" },
    },
  });

  const bumps = (["major", "minor", "patch"] as const).filter((b) => values[b]);
  if (bumps.length + (values.version ? 1 : 0) !== 1) {
    throw new Error(
      "Pass exactly one of --major, --minor, --patch, or --version <x.y.z>"
    );
  }

  const latest = latestVersion(remoteTags());
  const tag = nextTag(
    latest,
    values.version ? { version: values.version } : { bump: bumps[0] as Bump }
  );
  const summary = `${latest ? formatTag(latest) : "(no tags)"} → ${tag} on ${values.target}`;

  if (values["dry-run"]) {
    console.log(`Dry run: ${summary}`);
    return;
  }
  if (!values.yes) {
    if (!process.stdin.isTTY) {
      throw new Error("Not a TTY; pass --yes to release without a prompt");
    }
    if (!(await confirm(`Release ${summary}?`))) {
      console.log("Aborted.");
      return;
    }
  }

  execFileSync(
    "gh",
    [
      "release",
      "create",
      tag,
      "--target",
      values.target,
      "--title",
      tag,
      "--generate-notes",
    ],
    { stdio: "inherit" }
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
