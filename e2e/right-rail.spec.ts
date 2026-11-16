import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * The contextual inspector (issue #84, which replaced the always-open right
 * rail): closed by default, opened by selecting an item, and dismissed by
 * its close button or Escape, which return focus to the control that opened
 * it. On wide screens it's its own column and scrolls within itself: a long
 * inspector (Data Flow's top-ranked function has many evidence
 * `SourceLink`s, each with an absolutely-positioned `sr-only` suffix) must
 * not stretch the document past the page content. Reads `nielse63/RepoLore`
 * (this repository's own tree, persisted by `npm run seed:e2e`).
 */

const repoUrl = "/lore/nielse63/RepoLore";

const inspector = (page: Page) =>
  page.getByRole("complementary").filter({ has: page.locator("h2") });

test.use({ viewport: { width: 1440, height: 800 } });

const firstDependency = (page: Page) =>
  page.getByRole("button", { name: /^View .+ dependency details$/ }).first();

const SELECTIONS = [
  {
    path: "dependencies",
    trigger: firstDependency,
    kind: "Dependency evidence",
  },
  {
    path: "data-flow",
    trigger: (page: Page) =>
      page.getByRole("main").getByRole("listitem").getByRole("button").first(),
    kind: "Function relationships",
  },
];

for (const { path, trigger, kind } of SELECTIONS) {
  test(`the ${path} inspector is closed until an item is selected`, async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/${path}`);
    await expect(page.locator("#lore-inspector")).toHaveCount(0);

    await trigger(page).click();
    const panel = page.locator("#lore-inspector");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveRole("complementary");
    await expect(panel).toContainText(kind);
    await expect(
      panel.getByRole("button", { name: "Close inspector" })
    ).toBeFocused();
  });
}

test("Escape closes the inspector and returns focus to the selected row", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/dependencies`);
  const row = firstDependency(page);
  const name = (await row.textContent())!.trim();
  await row.click();
  await expect(page.locator("#lore-inspector")).toBeVisible();
  await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText(
    name
  );

  await page.keyboard.press("Escape");
  await expect(page.locator("#lore-inspector")).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("the close button returns focus to the opener, even after following a link inside the inspector", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/data-flow`);
  const rows = page.getByRole("main").getByRole("listitem").getByRole("button");
  // A function with at least one resolved caller or callee to follow.
  await rows.first().click();
  const panel = page.locator("#lore-inspector");
  const firstName = await panel
    .getByRole("heading", { level: 2 })
    .textContent();
  const related = panel
    .getByRole("listitem")
    .getByRole("button")
    .filter({ hasNotText: firstName! });
  await related.first().click();
  await expect(panel.getByRole("heading", { level: 2 })).not.toHaveText(
    firstName!
  );

  await panel.getByRole("button", { name: "Close inspector" }).click();
  await expect(panel).toHaveCount(0);
  await expect(rows.first()).toBeFocused();
});

for (const path of ["data-flow", "dependencies"]) {
  test(`the ${path} page's open inspector doesn't extend the page past its content`, async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/${path}`);
    await SELECTIONS.find((s) => s.path === path)!
      .trigger(page)
      .click();
    await expect(page.locator("#lore-inspector")).toBeVisible();

    const { documentHeight, bodyHeight } = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: Math.ceil(document.body.getBoundingClientRect().height),
    }));
    expect(documentHeight).toBeLessThanOrEqual(bodyHeight);
  });
}

test("on a wide screen the inspector is its own column, beside the main content", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/dependencies`);
  await firstDependency(page).click();
  const main = (await page.getByRole("main").boundingBox())!;
  const panel = (await page.locator("#lore-inspector").boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
  expect(panel.y).toBeLessThan(main.y + 50);
});

test("the Data Flow inspector is long enough to scroll within itself", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/data-flow`);
  await SELECTIONS[1].trigger(page).click();
  const scroller = page.locator("#lore-inspector > div");
  const { scrollHeight, clientHeight } = await scroller.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight * 2);
});

test.describe("at an intermediate width", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("the inspector follows the main content instead of taking a column", async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/dependencies`);
    await firstDependency(page).click();
    const main = (await page.getByRole("main").boundingBox())!;
    const panel = (await page.locator("#lore-inspector").boundingBox())!;
    expect(panel.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
    expect(panel.x).toBeLessThan(main.x + main.width / 2);
  });
});
