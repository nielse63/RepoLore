import { expect, test } from "./coverage";

/**
 * Systems page functional coverage (ADR-0014,
 * `src/app/lore/[owner]/[repo]/systems/[[...slug]]/page.tsx`): the list view
 * and per-area subview, both real and DB-backed. Like `not-found.spec.ts`'s
 * `/lore/{owner}/{repo}` cases, this needs `DATABASE_URL` (reading the
 * already-persisted `completed` analysis run for the pinned private fixture
 * `nielse63/repo-lore-ts-react-app-fixture`, see README "Fixtures") but not
 * `GITHUB_TOKEN`, since nothing here triggers a fresh analysis. That fixture
 * currently resolves to three Major Areas — `/src`, `/src/components`,
 * `/src/utils`, all classified "Implementation area" — at slugs `src`,
 * `src-components`, `src-utils`; if the fixture's source or re-analysis
 * changes those areas, the specific names/slugs/counts below need updating
 * to match.
 */

const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";
const systemsUrl = `${repoUrl}/systems`;

test("renders the systems list with real major areas, not example fixture data", async ({
  page,
}) => {
  await page.goto(systemsUrl);

  await expect(page.getByRole("heading", { name: "Systems" })).toBeVisible();
  await expect(page.getByText("3 systems identified")).toBeVisible();
  await expect(page.getByRole("link", { name: /^\/src\s/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/src\/components\s/ })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/src\/utils\s/ })
  ).toBeVisible();
  // The mockup's example data (`src/lib/fixtures/payments-service.ts`) should
  // be fully gone now that this page renders real analysis (ADR-0014).
  await expect(page.getByText("Payment Service")).toBeHidden();
});

test("the Systems sidebar link navigates to the real list", async ({
  page,
}) => {
  await page.goto(repoUrl);

  await page
    .getByRole("navigation", { name: "Repository sections" })
    .getByRole("link", { name: "Systems" })
    .click();

  await expect(page).toHaveURL(systemsUrl);
  await expect(page.getByRole("heading", { name: "Systems" })).toBeVisible();
});

test("search filters the systems list by name", async ({ page }) => {
  await page.goto(systemsUrl);

  await page.getByLabel("Search systems").fill("components");

  await expect(page.getByText("Showing 1–1 of 3 systems")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/src\/components\s/ })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /^\/src\s/ })).toBeHidden();
});

test("an unmatched search shows an honest empty state", async ({ page }) => {
  await page.goto(systemsUrl);

  await page.getByLabel("Search systems").fill("no-such-system");

  await expect(page.getByText("No systems match your search.")).toBeVisible();
});

test("filter pills filter the systems list by classification", async ({
  page,
}) => {
  await page.goto(systemsUrl);
  const filters = page.getByRole("group", {
    name: "Filter by classification",
  });

  await filters.getByRole("button", { name: "Tests" }).click();

  await expect(page.getByText("No systems match your search.")).toBeVisible();

  await filters.getByRole("button", { name: "All" }).click();

  await expect(page.getByText("Showing 1–3 of 3 systems")).toBeVisible();
});

test("clicking a system opens its subview with responsibilities, ownership, and evidence", async ({
  page,
}) => {
  await page.goto(systemsUrl);

  await page.getByRole("link", { name: /^\/src\/utils\s/ }).click();

  await expect(page).toHaveURL(`${systemsUrl}/src-utils`);
  await expect(page.getByRole("heading", { name: "/src/utils" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Responsibilities" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Owns" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Relationships" })
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Evidence" })
  ).toBeVisible();
});

test("the subview breadcrumb returns to the systems list", async ({ page }) => {
  await page.goto(`${systemsUrl}/src-utils`);

  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Systems" })
    .click();

  await expect(page).toHaveURL(systemsUrl);
  await expect(page.getByRole("heading", { name: "Systems" })).toBeVisible();
});

test("renders the not-found page for an unknown system slug", async ({
  page,
}) => {
  await page.goto(`${systemsUrl}/does-not-exist`);

  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
});

test("renders the not-found page for a nested subview path", async ({
  page,
}) => {
  await page.goto(`${systemsUrl}/src/extra-segment`);

  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
});
