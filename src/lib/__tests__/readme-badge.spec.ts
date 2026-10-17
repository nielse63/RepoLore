import { readmeBadgeMarkdown } from "../readme-badge";

describe("readmeBadgeMarkdown", () => {
  it("links the static badge to the repository's absolute Lore URL", () => {
    expect(
      readmeBadgeMarkdown("acme", "widgets", new URL("https://repolore.app"))
    ).toBe(
      "[![Repo Lore](https://repolore.app/badge.svg)](https://repolore.app/lore/acme/widgets)"
    );
  });
});
