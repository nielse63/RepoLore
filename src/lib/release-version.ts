/**
 * Semver arithmetic for `scripts/release.ts`: picking the latest `vX.Y.Z`
 * tag and computing the next one. Tags are the only record of the app
 * version (shown in the site footer via `app-version.ts`).
 */

export type Version = [major: number, minor: number, patch: number];
export type Bump = "major" | "minor" | "patch";

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Parses `1.2.3` or `v1.2.3`; `undefined` for anything else (pre-releases included). */
export function parseVersion(value: string): Version | undefined {
  const match = SEMVER.exec(value.trim());
  return match
    ? [Number(match[1]), Number(match[2]), Number(match[3])]
    : undefined;
}

export function formatTag([major, minor, patch]: Version): string {
  return `v${major}.${minor}.${patch}`;
}

export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** The highest semver among `tags`, ignoring non-semver tags; `undefined` if none. */
export function latestVersion(tags: string[]): Version | undefined {
  return tags
    .map(parseVersion)
    .filter((version): version is Version => version !== undefined)
    .sort(compareVersions)
    .at(-1);
}

export function bumpVersion(
  [major, minor, patch]: Version,
  bump: Bump
): Version {
  if (bump === "major") return [major + 1, 0, 0];
  if (bump === "minor") return [major, minor + 1, 0];
  return [major, minor, patch + 1];
}

/**
 * The tag to release: `latest` bumped, or an explicit version, which must be
 * newer than `latest`. With no prior tag, a bump starts from `v0.0.0`.
 */
export function nextTag(
  latest: Version | undefined,
  request: { bump: Bump } | { version: string }
): string {
  const base = latest ?? [0, 0, 0];
  if ("bump" in request) return formatTag(bumpVersion(base, request.bump));

  const version = parseVersion(request.version);
  if (!version) {
    throw new Error(`"${request.version}" is not a version like 1.2.3`);
  }
  if (latest && compareVersions(version, latest) <= 0) {
    throw new Error(
      `${formatTag(version)} is not newer than the latest tag ${formatTag(latest)}`
    );
  }
  return formatTag(version);
}
