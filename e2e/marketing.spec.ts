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

test("sitemap.xml lists the home page, /explore, and an indexable repository", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain("<urlset");
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/explore<\/loc>/);
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
  await expect(page).toHaveTitle(
    `${owner}/${repo}: codebase architecture & entry points — Repo Lore`
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    new RegExp(
      `How ${owner}/${repo} is structured: \\d+ probable entry points?`
    )
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

test("a submission redirect reports the run's outcome once and strips the marker", async ({
  page,
}) => {
  // gtag is only injected in production builds; stand in for it.
  await page.addInitScript(() => {
    const events: string[] = [];
    (window as unknown as { __events: string[] }).__events = events;
    (window as unknown as { gtag: unknown }).gtag = (
      _command: string,
      eventName: string
    ) => events.push(eventName);
  });

  await page.goto(`${repoUrl}?submitted=1`);
  await expect(page).toHaveURL(new RegExp(`${repoUrl}$`));
  expect(
    await page.evaluate(
      () => (window as unknown as { __events: string[] }).__events
    )
  ).toEqual(["analysis_completed"]);

  await page.reload();
  await expect(
    page.getByRole("region", { name: "Add a README badge" })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { __events: string[] }).__events
    )
  ).toEqual([]);
});

test("/explore is indexable and links to each indexable Lore", async ({
  page,
}) => {
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { level: 1, name: "Explore Lores" })
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/explore$/
  );

  await page
    .getByRole("link", { name: new RegExp(`${owner}/${repo}`) })
    .click();
  await expect(page).toHaveURL(new RegExp(`${repoUrl}$`));
});

test("the home page shows example Lores and links to /explore", async ({
  page,
}) => {
  await page.goto("/");
  const examples = page.getByRole("region", { name: "See an example Lore" });
  await expect(examples.getByRole("listitem").first()).toBeVisible();

  await examples.getByRole("link", { name: "Browse all Lores" }).click();
  await expect(page).toHaveURL(/\/explore$/);
});
