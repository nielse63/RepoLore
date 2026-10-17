import { expect, test } from "./coverage";

/**
 * Site footer (`SiteFooter`) and `/manifesto` coverage. The footer is
 * checked on every kind of route: `SiteShell` pages (home, `/explore`,
 * `/manifesto`, not-found, an unanalyzed repository) and a Lore page, where
 * it sits at the end of `LorePageFrame`'s main column. Those last two need
 * `DATABASE_URL` (the pinned fixture `nielse63/repo-lore-ts-react-app-fixture`
 * has a persisted run) but not `GITHUB_TOKEN`.
 */

const routes = [
  "/",
  "/explore",
  "/manifesto",
  "/this-page-does-not-exist",
  "/lore/nielse63/repo-lore-never-analyzed-e2e",
  "/lore/nielse63/repo-lore-ts-react-app-fixture",
  "/lore/nielse63/repo-lore-ts-react-app-fixture/architecture",
];

for (const route of routes) {
  test(`shows the footer on ${route}`, async ({ page }) => {
    await page.goto(route);
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Manifesto" })).toBeVisible();
    await expect(
      footer.getByRole("link", { name: "Explore Lores" })
    ).toBeVisible();
    await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/nielse63/RepoLore"
    );
    await expect(footer).toContainText(
      `© ${new Date().getFullYear()} Repo Lore`
    );
  });
}

test("the footer's Manifesto link opens the manifesto", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Manifesto" })
    .click();
  await expect(page).toHaveURL(/\/manifesto$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "The Repo Lore Manifesto" })
  ).toBeVisible();
});

test("/manifesto renders every section and is indexable", async ({ page }) => {
  await page.goto("/manifesto");
  await expect(page).toHaveTitle("The Repo Lore Manifesto");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Software Should Be Understandable",
    "Information Is Not Understanding",
    "Evidence Before Explanation",
    "Confidence Must Be Justified",
    "The Reading Path Matters",
    "The Model Is the Durable Asset",
    "Engineering Knowledge Belongs to the Organization",
    "Automatic by Default",
    "Build the Smallest Trustworthy Product",
  ]);
  await expect(
    page.getByText("Evidence first. Explanation second.")
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/manifesto$/
  );
});
