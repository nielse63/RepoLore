import { expect, test } from "./coverage";

/**
 * Regression coverage for GitHub issue #50: a test suite nesting many small
 * sample-case directories (`packages/<pkg>/tests/<suite>/samples/<case>/`,
 * as in `sveltejs/svelte`) used to become one Major Area per case — 2,994 of
 * them for Svelte — none classified as tests. Reads the persisted run for
 * the local-only fixture `nielse63/repo-lore-ts-nested-test-samples-fixture`
 * (`fixtures/ts-nested-test-samples`, written by `npm run seed:e2e`; needs
 * `DATABASE_URL`, not `GITHUB_TOKEN`), whose twelve one-file sample cases
 * under `packages/core/tests` should be one "Tests" area alongside
 * `packages/core/src`. Its `packages/test` is a test-named directory that
 * production code imports (a shipped helper package, like Django's
 * `django/test/`), so detected structure overrules its name and it stays an
 * implementation area. The fixture has no GitHub repository, so its run is
 * keyed to a placeholder commit and its source links lead nowhere.
 *
 * GitHub issue #65: the same nested suite holds a runnable harness
 * (`run-harness.js`, a `ReactDOM.render` call) and a test helper
 * (`helpers.js`) that `compile.test.js` imports. File-level analysis used to
 * miss that they're under a test directory, so the harness became the
 * Lore's bootstrap entry point and Start Here's first step, and the helper
 * was reported as the implementation `compile.test.js` tests.
 */

const repoUrl = "/lore/nielse63/repo-lore-ts-nested-test-samples-fixture";
const systemsUrl = `${repoUrl}/systems`;
const architectureUrl = `${repoUrl}/architecture`;

test.beforeEach(async ({ page }) => {
  await page.goto(repoUrl);
  await expect(
    page.getByRole("heading", { name: /hasn't been analyzed yet/ }),
    "The fixture's run is missing from DATABASE_URL — run `npm run seed:e2e` against it first"
  ).toBeHidden();
});

test("the Overview lists a nested test directory as one Major Area, not one per sample case", async ({
  page,
}) => {
  await page.goto(repoUrl);

  // Ranked order (issue #48): implementation areas by relationships, then
  // the Tests area last.
  await expect(page.locator("#major-areas h3")).toHaveText([
    /^\/packages\/core\/src\s/,
    /^\/packages\/test\s/,
    /^\/packages\/core\/tests\s/,
  ]);
});

test("the Systems page classifies the nested test directory as Tests", async ({
  page,
}) => {
  await page.goto(systemsUrl);

  await expect(page.getByText("3 systems identified")).toBeVisible();

  await page
    .getByRole("group", { name: "Filter by classification" })
    .getByRole("button", { name: "Tests" })
    .click();

  await expect(page.getByText("Showing 1–1 of 3 systems")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/packages\/core\/tests\s/ })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/packages\/core\/src\s/ })
  ).toBeHidden();
  await expect(
    page.getByRole("link", { name: /^\/packages\/test\s/ })
  ).toBeHidden();
});

test("a test-named directory that production code imports stays an implementation area", async ({
  page,
}) => {
  await page.goto(systemsUrl);

  await page
    .getByRole("group", { name: "Filter by classification" })
    .getByRole("button", { name: "Implementation" })
    .click();

  await expect(page.getByText("Showing 1–2 of 3 systems")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/packages\/test\s/ })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^\/packages\/core\/src\s/ })
  ).toBeVisible();
});

test("Start Here and Entry Points don't treat a harness in the nested test directory as where the system starts", async ({
  page,
}) => {
  await page.goto(repoUrl);

  const startHereSteps = page.locator("#start-here ol > li");
  await expect(startHereSteps.first()).toContainText(
    "/packages/core/src/index.ts"
  );
  await expect(page.locator("#start-here")).not.toContainText("run-harness");

  await page.goto(architectureUrl);
  const entryPoints = page
    .getByRole("heading", { name: "Entry Points" })
    .locator("xpath=..");
  await expect(entryPoints.getByRole("listitem")).toHaveText([
    /^Library \/packages\/core\/src\/index\.ts/,
  ]);
});

test("a test's helper in the nested test directory isn't reported as the implementation it tests", async ({
  page,
}) => {
  await page.goto(architectureUrl);

  const testRelationships = page.locator("#test-relationships");
  await expect(testRelationships.getByRole("listitem")).toHaveText([
    /\/packages\/core\/tests\/runtime\/compile\.test\.js.*tests.*\/packages\/core\/src\/compile\.ts/,
  ]);
  // Matched by filename convention once the helper import is discounted —
  // not by an import, so it must say so.
  await expect(testRelationships.getByRole("listitem")).toContainText(
    "Inferred"
  );
  await expect(testRelationships).not.toContainText("helpers.js");
});
