import { expect, test } from "./coverage";

/**
 * Not-found page functional coverage (`src/app/not-found.tsx`). Only exercises
 * top-level unmatched routes, which hit the root layout and no other data
 * dependency — so, like `home.spec.ts`, this suite needs no `GITHUB_TOKEN` or
 * database. `/lore/{owner}/{repo}/systems` also renders this page (via the
 * `systems/[[...slug]]` stub, see README "Design system and UI routes"), but
 * its layout loads the analysis run from Postgres before the stub ever runs,
 * so it isn't covered here.
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
