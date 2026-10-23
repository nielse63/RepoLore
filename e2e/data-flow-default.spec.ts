import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * The Data Flow page opens in its most informative state (GitHub issue #7):
 * List view, sorted by Importance (descending), with the detail panel
 * focused on the top-ranked function — not Chain view in alphabetical order
 * focused on an arbitrary zero-importance entry. Reads `nielse63/RepoLore`
 * (this repository's own tree, persisted by `npm run seed:e2e`), whose
 * alphabetically first function is a zero-importance config callback.
 * Each assertion is checked against the scores the page itself displays.
 */

const dataFlowUrl = "/lore/nielse63/RepoLore/data-flow";

interface ListedFunction {
  name: string;
  score: number;
}

/**
 * Reads each List-view row's function name and displayed importance score
 * (function rows carry a name paragraph; pagination buttons don't).
 */
async function listedFunctions(page: Page): Promise<ListedFunction[]> {
  return page
    .getByRole("main")
    .getByRole("listitem")
    .getByRole("button")
    .filter({ has: page.locator("p") })
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const spans = [...button.querySelectorAll(":scope > span")].map(
          (s) => s.textContent ?? ""
        );
        return {
          name: button.querySelector("p")?.textContent ?? "",
          score: Number(spans.find((t) => /^\d+$/.test(t))),
        };
      })
    );
}

const rail = (page: Page) => page.locator("#right-rail");
const pagination = (page: Page) =>
  page.getByRole("main").getByRole("navigation", { name: "Pagination" });
const currentPage = (page: Page) =>
  pagination(page).locator('[aria-current="page"]');

test("Data Flow opens in List view, ranked by importance, focused on the top function", async ({
  page,
}) => {
  await page.goto(dataFlowUrl);

  // The default view is listed first.
  await expect(
    page.getByRole("group", { name: "View mode" }).getByRole("button")
  ).toHaveText(["List", "Chain"]);
  await expect(
    page.getByRole("group", { name: "Sort by" }).getByRole("button")
  ).toHaveText(["Importance", "Name"]);
  await expect(
    page
      .getByRole("group", { name: "View mode" })
      .getByRole("button", { name: "List" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page
      .getByRole("group", { name: "Sort by" })
      .getByRole("button", { name: "Importance" })
  ).toHaveAttribute("aria-pressed", "true");

  const functions = await listedFunctions(page);
  expect(functions.length).toBeGreaterThanOrEqual(5);
  expect(functions.length).toBeLessThanOrEqual(15);
  const scores = functions.map((f) => f.score);
  expect(scores.every(Number.isFinite)).toBe(true);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  expect(scores[0]).toBeGreaterThan(0);

  // The pre-selected function is the top-ranked one, not the first by name.
  const top = functions[0];
  await expect(rail(page).getByRole("heading", { level: 2 })).toHaveText(
    top.name
  );
  await expect(rail(page)).toContainText(`Importance${top.score}`);
  const alphabeticalFirst = [...functions].sort((a, b) =>
    a.name.localeCompare(b.name)
  )[0];
  expect(top.name).not.toBe(alphabeticalFirst.name);
});

test("the function list is paginated, continuing the importance ranking across pages", async ({
  page,
}) => {
  await page.goto(dataFlowUrl);
  await expect(currentPage(page)).toHaveText("1");
  const firstPage = await listedFunctions(page);

  await pagination(page)
    .getByRole("button", { name: "Go to next page" })
    .click();
  await expect(currentPage(page)).toHaveText("2");
  const secondPage = await listedFunctions(page);
  expect(secondPage.length).toBeGreaterThan(0);
  expect(secondPage.length).toBeLessThanOrEqual(firstPage.length);
  const scores = [...firstPage, ...secondPage].map((f) => f.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  const firstNames = new Set(firstPage.map((f) => f.name));
  expect(secondPage.some((f) => !firstNames.has(f.name))).toBe(true);

  // The page survives switching to Chain and back...
  const viewMode = page.getByRole("group", { name: "View mode" });
  await viewMode.getByRole("button", { name: "Chain" }).click();
  await viewMode.getByRole("button", { name: "List" }).click();
  await expect(currentPage(page)).toHaveText("2");

  // ...and changing the sort or search returns to page 1.
  await page
    .getByRole("group", { name: "Sort by" })
    .getByRole("button", { name: "Name" })
    .click();
  await expect(currentPage(page)).toHaveText("1");
  await pagination(page)
    .getByRole("button", { name: "Go to next page" })
    .click();
  await expect(currentPage(page)).toHaveText("2");
  // A broad search that still spans several pages.
  await page.getByLabel("Search functions").fill("e");
  await expect(currentPage(page)).toHaveText("1");
  const matches = await listedFunctions(page);
  expect(matches.length).toBeGreaterThan(0);
  expect(matches.every((f) => f.name.toLowerCase().includes("e"))).toBe(true);
  const names = matches.map((f) => f.name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test("the Name sort and Chain view remain one click away", async ({ page }) => {
  await page.goto(dataFlowUrl);

  await page
    .getByRole("group", { name: "Sort by" })
    .getByRole("button", { name: "Name" })
    .click();
  const names = (await listedFunctions(page)).map((f) => f.name);
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));

  await page
    .getByRole("group", { name: "View mode" })
    .getByRole("button", { name: "Chain" })
    .click();
  await expect(page.getByRole("group", { name: "Sort by" })).toBeHidden();
  await expect(
    page.getByRole("main").getByRole("listitem").first()
  ).toBeVisible();
});

test("a repository with no named functions shows the empty state, not an empty search", async ({
  page,
}) => {
  await page.goto("/lore/nielse63/repo-lore-python-only-fixture/data-flow");

  await expect(
    page.getByText(
      "No named functions were detected. Data Flow analysis currently covers JavaScript and TypeScript projects only."
    )
  ).toBeVisible();
  await expect(page.getByText(/No functions match/)).toBeHidden();
  await expect(page.locator("#right-rail")).toBeHidden();
});

test.describe("at a 1440×800 viewport", () => {
  test.use({ viewport: { width: 1440, height: 800 } });

  test("the first page fills the screen below the header with compact, one-line rows", async ({
    page,
  }) => {
    await page.goto(dataFlowUrl);
    const rows = page
      .getByRole("main")
      .getByRole("listitem")
      .getByRole("button")
      .filter({ has: page.locator("p") });
    await expect(rows.first()).toBeVisible();

    const boxes = await rows.evaluateAll((buttons) =>
      buttons.map((b) => {
        const { top, bottom, height } = b.getBoundingClientRect();
        return { top, bottom, height };
      })
    );
    expect(boxes.length).toBeGreaterThanOrEqual(7);
    for (const box of boxes) expect(box.height).toBeLessThan(60);

    // Every row is on screen without scrolling, and another wouldn't fit.
    const last = boxes[boxes.length - 1];
    const viewportHeight = page.viewportSize()!.height;
    expect(last.bottom).toBeLessThanOrEqual(viewportHeight);
    expect(viewportHeight - last.bottom).toBeLessThan(last.height + 1);
  });
});
