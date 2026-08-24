import { expect, test } from "./coverage";

/**
 * Not-found page functional coverage (`src/app/not-found.tsx`): top-level
 * unmatched routes (root layout only, no `GITHUB_TOKEN` or database needed,
 * like `home.spec.ts`), plus `/lore/{owner}/{repo}` unmatched subpages, which
 * additionally need `DATABASE_URL` since that layout loads the analysis run
 * from Postgres before the 404 renders (but not `GITHUB_TOKEN` — it reads the
 * already-persisted `completed` analysis run for the pinned private fixture
 * `nielse63/repo-lore-ts-react-app-fixture`, see README "Fixtures", rather
 * than exercising the real submit/analyze flow). `/lore/{owner}/{repo}/systems`
 * also renders this page (via the `systems/[[...slug]]` stub, see README
 * "Design system and UI routes"), but isn't covered here.
 */

test("renders the not-found page for an unmatched route", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back to Repo Lore" })
  ).toBeVisible();
});

test("Back to Repo Lore returns to the previous page when it was reached via an in-app link", async ({
  page,
}) => {
  await page.goto("/");
  const homeUrl = page.url();
  // `referer` simulates arriving here by clicking a link on the home page,
  // rather than a fresh `goto` (which leaves `document.referrer` empty).
  await page.goto("/this-page-does-not-exist", { referer: homeUrl });

  await page.getByRole("button", { name: "Back to Repo Lore" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Understand any codebase with confidence.",
    })
  ).toBeVisible();
});

test("Back to Repo Lore falls back to home when reached directly (no referrer)", async ({
  page,
}) => {
  await page.goto("/this-page-does-not-exist");

  await page.getByRole("button", { name: "Back to Repo Lore" }).click();

  await expect(
    page.getByRole("heading", {
      name: "Understand any codebase with confidence.",
    })
  ).toBeVisible();
});

const validRepoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";
const invalidSubpageUrl = `${validRepoUrl}/page-does-not-exist`;

test("renders the lore report for a valid repository, not the not-found page", async ({
  page,
}) => {
  await page.goto(validRepoUrl);

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeHidden();
});

test("renders the not-found page for an invalid subpage of a valid repository", async ({
  page,
}) => {
  await page.goto(invalidSubpageUrl);

  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeHidden();
});

test("Back to Repo Lore returns to the lore report, not the home page", async ({
  page,
}) => {
  await page.goto(validRepoUrl);
  const repoUrl = page.url();
  // `referer` simulates arriving at the invalid subpage via an in-app link
  // from the lore report, rather than a fresh `goto` (which leaves
  // `document.referrer` empty) — see src/lib/back-destination.ts.
  await page.goto(invalidSubpageUrl, { referer: repoUrl });

  await page.getByRole("button", { name: "Back to Repo Lore" }).click();

  await expect(page).toHaveURL(repoUrl);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
