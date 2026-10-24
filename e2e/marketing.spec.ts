import { expect, test } from "./coverage";

/**
 * Search/sharing surface functional coverage: `robots.txt`, `sitemap.xml`, the per-repository Open Graph image, and
 * the Overview's README badge card. Like `systems.spec.ts`, needs
 * `DATABASE_URL` for already-persisted runs but not `GITHUB_TOKEN`. The
 * seeded `nielse63/RepoLore` Lore's latest run is `completed`, public, and
 * has entry points and areas, so it's the positive case for
 * `isIndexableLore`: indexed, and listed in the sitemap and on `/explore`.
 * The pinned fixture `nielse63/repo-lore-ts-react-app-fixture` passes every
 * quality check too, but is one of Repo Lore's own test fixtures, so it
 * still renders yet is neither indexed nor listed (GitHub issue #44). The
 * other negative cases are unit-tested
 * (`src/lib/__tests__/lore-indexability.spec.ts`).
 */

const owner = "nielse63";
const repo = "repo-lore-ts-react-app-fixture";
const repoUrl = `/lore/${owner}/${repo}`;
const indexableRepo = "RepoLore";
const indexableUrl = `/lore/${owner}/${indexableRepo}`;

test("robots.txt allows crawling except the API and points at the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toMatch(/Disallow: \/api\//);
  expect(body).toMatch(/Sitemap: https?:\/\/\S+\/sitemap\.xml/);
});

test("sitemap.xml lists the static pages and an indexable repository", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toContain("<urlset");
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/explore<\/loc>/);
  expect(body).toMatch(/<loc>https?:\/\/[^<]+\/manifesto<\/loc>/);
  expect(body).toMatch(new RegExp(`<loc>https?://[^<]+${indexableUrl}</loc>`));
  expect(body).not.toContain(`/lore/${owner}/repo-lore-`);
});

test("an indexable Overview is index, follow; its subviews stay noindex", async ({
  page,
}) => {
  await page.goto(indexableUrl);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow"
  );
  await expect(page).toHaveTitle(
    `${owner}/${indexableRepo}: codebase architecture & entry points — Repo Lore`
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    new RegExp(
      `How ${owner}/${indexableRepo} is structured: \\d+ probable entry points?`
    )
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`${indexableUrl}/opengraph-image`)
  );

  await page.goto(`${indexableUrl}/architecture`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow"
  );
});

test("Repo Lore's own test fixture renders but is noindex and unlisted (issue #44)", async ({
  page,
}) => {
  await page.goto(repoUrl);
  await expect(page.locator("#major-areas h3").first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow"
  );

  await page.goto("/explore");
  const lores = page.getByRole("main").getByRole("listitem").getByRole("link");
  await expect(
    lores.filter({ hasText: `${owner}/${indexableRepo}` })
  ).toHaveCount(1);
  await expect(lores.filter({ hasText: /repo-lore-.*-fixture/ })).toHaveCount(
    0
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
  // Stand in for gtag. The event fires on hydration, before the production
  // layout's `afterInteractive` gtag shim would replace this stub.
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
    .getByRole("link", { name: new RegExp(`${owner}/${indexableRepo}`) })
    .click();
  await expect(page).toHaveURL(new RegExp(`${indexableUrl}$`));
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

test("/explore's Major Area count matches the areas the Overview lists", async ({
  page,
}) => {
  await page.goto("/explore");
  const card = page.getByRole("link", {
    name: new RegExp(`${owner}/${indexableRepo}`),
  });
  const match = (await card.textContent())?.match(/(\d+) major areas?/);
  expect(match).not.toBeNull();
  const listed = Number(match![1]);

  // The Overview paginates its Major Areas 6 per page, and an out-of-range
  // `?page=` shows the last page, so the total is every full page plus that one.
  await page.goto(`${indexableUrl}?page=9999`);
  const lastPage = Number(
    await page
      .locator("#major-areas")
      .getByRole("navigation", { name: "Pagination" })
      .locator('[aria-current="page"]')
      .textContent()
  );
  const onLastPage = await page.locator("#major-areas h3").count();
  expect((lastPage - 1) * 6 + onLastPage).toBe(listed);
});
