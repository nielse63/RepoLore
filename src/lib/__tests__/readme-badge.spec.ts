import { badgeImageUrl, loreUrl, readmeBadgeSnippets } from "../readme-badge";

const site = new URL("https://repolore.app");

describe("loreUrl", () => {
  it("is the repository's absolute Lore URL", () => {
    expect(loreUrl("acme", "widgets", site)).toBe(
      "https://repolore.app/lore/acme/widgets"
    );
  });

  it("encodes owner and repo as path segments", () => {
    expect(loreUrl("a&b", "c d?", site)).toBe(
      "https://repolore.app/lore/a%26b/c%20d%3F"
    );
  });
});

describe("badgeImageUrl", () => {
  it("is the static badge's absolute URL", () => {
    expect(badgeImageUrl(new URL("http://localhost:3100"))).toBe(
      "http://localhost:3100/badge.svg"
    );
  });
});

describe("readmeBadgeSnippets", () => {
  it("offers Markdown, HTML, reStructuredText, and AsciiDoc, in that order", () => {
    expect(
      readmeBadgeSnippets("acme", "widgets", site).map((s) => [
        s.format,
        s.label,
      ])
    ).toEqual([
      ["markdown", "Markdown"],
      ["html", "HTML"],
      ["restructuredtext", "reStructuredText"],
      ["asciidoc", "AsciiDoc"],
    ]);
  });

  it("links the static badge to the repository's absolute Lore URL in every format", () => {
    const bySnippet = Object.fromEntries(
      readmeBadgeSnippets("acme", "widgets", site).map((s) => [
        s.format,
        s.snippet,
      ])
    );
    expect(bySnippet).toEqual({
      markdown:
        "[![Repo Lore](https://repolore.app/badge.svg)](https://repolore.app/lore/acme/widgets)",
      html: '<a href="https://repolore.app/lore/acme/widgets"><img src="https://repolore.app/badge.svg" alt="Repo Lore"></a>',
      restructuredtext:
        ".. image:: https://repolore.app/badge.svg\n   :target: https://repolore.app/lore/acme/widgets\n   :alt: Repo Lore",
      asciidoc:
        "image:https://repolore.app/badge.svg[Repo Lore,link=https://repolore.app/lore/acme/widgets]",
    });
  });
});
