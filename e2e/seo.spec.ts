import { expect, test } from "./coverage";

/**
 * Search-engine metadata coverage. The public pages — home, `/explore`,
 * `/manifesto`, and an indexable Lore Overview — must each be indexable and
 * carry a unique title, a description, a self-referencing canonical, Open
 * Graph/Twitter cards, `<html lang>`, and a single `<h1>`. Everything else a
 * crawler can reach — Lore subviews, a not-yet-analyzed Lore, and 404s —
 * must say `noindex`, and the sitemap must list only the public pages.
 *
 * The Overview-specific title/description wording, robots.txt, and the Open
 * Graph image route are covered in `marketing.spec.ts`. The Lore pages read
 * already-persisted `completed` runs (needs `DATABASE_URL`, not
 * `GITHUB_TOKEN`): the seeded `nielse63/RepoLore`, whose latest run
 * `isIndexableLore` accepts, and the pinned fixture
 * `nielse63/repo-lore-ts-react-app-fixture`, which it rejects as one of Repo
 * Lore's own test fixtures (GitHub issue #44).
 */

const indexableUrl = "/lore/nielse63/RepoLore";
const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";

const PUBLIC_PAGES = ["/", "/explore", "/manifesto", indexableUrl];

const NOINDEX_PAGES = [
  repoUrl,
  `${repoUrl}/architecture`,
  `${repoUrl}/dependencies`,
  `${repoUrl}/data-flow`,
  `${repoUrl}/history`,
  `${repoUrl}/systems`,
  `${repoUrl}/systems/src`,
  `${repoUrl}/page-does-not-exist`,
  "/lore/nielse63/repo-lore-seo-never-analyzed",
  "/this-page-does-not-exist",
];

/** An absolute URL whose path is exactly `path` (the home page's may omit its `/`). */
function absoluteUrlFor(path: string): RegExp {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^https?://[^/]+${path === "/" ? "/?" : escaped}$`);
}

for (const path of PUBLIC_PAGES) {
  test(`${path} is indexable with complete search and sharing metadata`, async ({
    page,
  }) => {
    await page.goto(path);

    // No robots meta at all also means "index, follow".
    await expect(
      page.locator('meta[name="robots"][content*="noindex"]')
    ).toHaveCount(0);

    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /\S/
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      absoluteUrlFor(path)
    );

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /\S/
    );
    await expect(
      page.locator('meta[property="og:description"]')
    ).toHaveAttribute("content", /\S/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      absoluteUrlFor(path)
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /^https?:\/\//
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image"
    );

    await expect(page.locator("h1")).toHaveCount(1);
  });
}

test("each public page has a unique title and description", async ({
  page,
}) => {
  const titles: string[] = [];
  const descriptions: string[] = [];
  for (const path of PUBLIC_PAGES) {
    await page.goto(path);
    titles.push(await page.title());
    descriptions.push(
      (await page
        .locator('meta[name="description"]')
        .getAttribute("content")) ?? ""
    );
  }
  expect(new Set(titles).size).toBe(PUBLIC_PAGES.length);
  expect(new Set(descriptions).size).toBe(PUBLIC_PAGES.length);
});

for (const path of NOINDEX_PAGES) {
  test(`${path} is noindex`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /\bnoindex\b/
    );
  });
}

test("sitemap.xml lists only public pages", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)];
  expect(locs.length).toBeGreaterThan(0);
  for (const [, loc] of locs) {
    expect(new URL(loc).pathname).toMatch(
      /^\/(explore|manifesto|lore\/[^/]+\/[^/]+)?$/
    );
    expect(new URL(loc).pathname).not.toMatch(/\/repo-lore-[^/]*-fixture$/);
  }
});
