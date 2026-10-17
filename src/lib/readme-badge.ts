/**
 * The Markdown a maintainer pastes into their README (docs/MARKETING.md
 * item 6): the static `/badge.svg` linking to the repository's stable Lore
 * URL. Absolute URLs, since a README renders on github.com, not here.
 */
export function readmeBadgeMarkdown(
  owner: string,
  repo: string,
  siteBase: URL
): string {
  const badgeUrl = new URL("/badge.svg", siteBase).toString();
  const loreUrl = new URL(`/lore/${owner}/${repo}`, siteBase).toString();
  return `[![Repo Lore](${badgeUrl})](${loreUrl})`;
}
