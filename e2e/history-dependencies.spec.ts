import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * Regression coverage for GitHub issue #41: History reported lockfile field
 * names (`resolved`, `integrity`), nested `engines` keys, transitive ranges
 * inside other packages' `dependencies`, and `package.json` `scripts` edits
 * as dependency changes. `npm run seed:e2e` builds this fixture's History
 * cache with the real classifier from recorded GitHub commit-detail payloads
 * (`fixtures/history-commits/dependency-commits.json`): a lockfile-only bump
 * touching three `node_modules/…` entries, and a `package.json` edit that
 * changes `scripts.build` and `engines.node` and adds `zod` to
 * `dependencies`. The GitHub fetch itself is replaced by those recordings.
 */

const historyUrl =
  "/lore/nielse63/repo-lore-ts-nested-test-samples-fixture/history";

function whatChanged(page: Page) {
  return page
    .getByText("What changed", { exact: true })
    .locator("xpath=following-sibling::ul")
    .getByRole("listitem");
}

test.beforeEach(async ({ page }) => {
  await page.goto(historyUrl);
  await expect(
    page.getByText(/No meaningful changes were detected/),
    "The fixture's History cache is missing from DATABASE_URL — run `npm run seed:e2e` against it first"
  ).toBeHidden();
});

test("a lockfile-only commit is one summary fact counting changed package entries", async ({
  page,
}) => {
  await page
    .getByRole("listitem")
    .getByRole("button", { name: /3 packages changed in package-lock\.json/ })
    .click();

  await expect(whatChanged(page)).toHaveText([
    "3 packages changed in package-lock.json",
  ]);
});

test("a package.json edit reports only the dependency-section change", async ({
  page,
}) => {
  await page
    .getByRole("listitem")
    .getByRole("button", {
      name: /zod added in packages\/core\/package\.json/i,
    })
    .click();

  await expect(whatChanged(page)).toHaveText([
    /^zod added in packages\/core\/package\.json$/i,
  ]);
});

test("no lockfile field, nested key, or script is reported as a dependency", async ({
  page,
}) => {
  await expect(
    page.getByText(
      /^(resolved|integrity|node|body-parser|build|@rollup\/rollup-android-arm64) (added|removed)/i
    )
  ).toHaveCount(0);
});

test("the timeframe picker narrows to a custom range and resets to the default window", async ({
  page,
}) => {
  const trigger = page.locator("#git-history-timeframe");
  await expect(trigger).toHaveText(/Last 90 days/);
  await trigger.click();

  const from = page.getByRole("button", { name: /^From/ });
  await from.click();
  await expect(from).toHaveAttribute("aria-expanded", "true");
  // The first selectable day after the window's current start.
  const day = page
    .getByRole("gridcell", { selected: false })
    .getByRole("button", { disabled: false })
    .first();
  await day.click();

  await expect(from).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toHaveText(
    /[A-Z][a-z]{2} \d{1,2}(, \d{4})? – [A-Z][a-z]{2} \d{1,2}, \d{4}/
  );

  await page.getByRole("button", { name: "Reset to last 90 days" }).click();
  await expect(trigger).toHaveText(/Last 90 days/);
});
