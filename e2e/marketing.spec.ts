import { expect, test } from "./coverage";

/**
 * Search/sharing surface functional coverage: `robots.txt`, `sitemap.xml`, the per-repository Open Graph image, and
 * the Overview's README badge card. Like `systems.spec.ts`, needs
 * `DATABASE_URL` for the already-persisted run of the pinned fixture
 * `nielse63/repo-lore-ts-react-app-fixture` but not `GITHUB_TOKEN`. That
 * fixture's latest run is `completed`, public, and has entry points and
 * areas, so it's the positive case for `isIndexableLore`: indexed and listed
 * in the sitemap. The negative cases are unit-tested
 * (`src/lib/__tests__/lore-indexability.spec.ts`).
 */

const owner = "nielse63";
const repo = "repo-lore-ts-react-app-fixture";
const repoUrl = `/lore/${owner}/${repo}`;

test("robots.txt allows crawling except the API and points at the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toMatch(/Disallow: \/api\//);
  expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

test("sitemap.xml lists the home page and an indexable repository", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain("<urlset");
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(body).toMatch(new RegExp(`<loc>https?://[^<]+${repoUrl}</loc>`));
});

test("an indexable Overview is index, follow; its subviews stay noindex", async ({
  page,
}) => {
  await page.goto(repoUrl);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow"
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`${repoUrl}/opengraph-image`)
  );

  await page.goto(`${repoUrl}/architecture`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow"
  );
});

test("serves a PNG Open Graph image for a repository", async ({ request }) => {
  const response = await request.get(`${repoUrl}/opengraph-image`);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("the README badge card copies Markdown linking the badge to this Lore", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(repoUrl);

  const card = page.getByRole("region", { name: "Add a README badge" });
  await expect(card).toBeVisible();
  const snippet = card.locator("code");
  await expect(snippet).toHaveText(
    new RegExp(
      String.raw`^\[!\[Repo Lore\]\(https?://\S+/badge\.svg\)\]\(https?://\S+${repoUrl}\)$`
    )
  );

  await card.getByRole("button", { name: "Copy badge Markdown" }).click();
  await expect(card.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await snippet.textContent()
  );
});

test("serves the static badge SVG", async ({ request }) => {
  const response = await request.get("/badge.svg");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
});
