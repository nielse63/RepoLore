export type ReadmeBadgeFormat =
  "markdown" | "html" | "restructuredtext" | "asciidoc";

export interface ReadmeBadgeSnippet {
  format: ReadmeBadgeFormat;
  label: string;
  snippet: string;
}

/** The repository's stable, absolute Lore URL. */
export function loreUrl(owner: string, repo: string, siteBase: URL): string {
  const path = `/lore/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  return new URL(path, siteBase).toString();
}

/** The static badge image's absolute URL. */
export function badgeImageUrl(siteBase: URL): string {
  return new URL("/badge.svg", siteBase).toString();
}

/**
 * What a maintainer pastes into their README, one entry per markup format
 * (issue #67): the static `/badge.svg` linking to the repository's stable
 * Lore URL. Absolute URLs, since a README renders on github.com or PyPI,
 * not here. reStructuredText is included because many Python READMEs use it.
 * Both URLs come from `new URL` with percent-encoded path segments, so they
 * can't contain characters that would need escaping in any of these formats.
 */
export function readmeBadgeSnippets(
  owner: string,
  repo: string,
  siteBase: URL
): ReadmeBadgeSnippet[] {
  const image = badgeImageUrl(siteBase);
  const lore = loreUrl(owner, repo, siteBase);
  return [
    {
      format: "markdown",
      label: "Markdown",
      snippet: `[![Repo Lore](${image})](${lore})`,
    },
    {
      format: "html",
      label: "HTML",
      snippet: `<a href="${lore}"><img src="${image}" alt="Repo Lore"></a>`,
    },
    {
      format: "restructuredtext",
      label: "reStructuredText",
      snippet: `.. image:: ${image}\n   :target: ${lore}\n   :alt: Repo Lore`,
    },
    {
      format: "asciidoc",
      label: "AsciiDoc",
      snippet: `image:${image}[Repo Lore,link=${lore}]`,
    },
  ];
}
