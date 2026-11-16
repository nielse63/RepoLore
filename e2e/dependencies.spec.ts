import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * Dependencies table sorting. Reads `nielse63/RepoLore` (this repository's
 * own tree, persisted by `npm run seed:e2e`), whose external dependencies
 * span several pages and both Production and Development scopes. Each
 * assertion is checked against the values the table itself displays.
 */

const dependenciesUrl = "/lore/nielse63/RepoLore/dependencies";

interface Row {
  name: string;
  scope: string;
  references: number;
}

async function rows(page: Page): Promise<Row[]> {
  return page
    .getByRole("tabpanel")
    .locator("tbody tr")
    .evaluateAll((trs) =>
      trs.map((tr) => {
        const cells = [...tr.querySelectorAll("td")].map(
          (td) => td.textContent?.trim() ?? ""
        );
        return {
          name: cells[0],
          scope: cells[1],
          references: Number(cells[3].match(/^\d+/)?.[0]),
        };
      })
    );
}

const sortButton = (page: Page, label: string) =>
  page.getByRole("columnheader", { name: label }).getByRole("button");

const pagination = (page: Page) =>
  page.getByRole("tabpanel").getByRole("navigation", { name: "Pagination" });

test("sorting by Scope groups the rows by scope label", async ({ page }) => {
  await page.goto(dependenciesUrl);
  await sortButton(page, "Scope").click();
  await expect(
    page.getByRole("columnheader", { name: "Scope" })
  ).toHaveAttribute("aria-sort", "ascending");

  const scopes = (await rows(page)).map((r) => r.scope);
  expect(scopes).toEqual([...scopes].sort((a, b) => a.localeCompare(b)));
});

test("sorting by Evidence orders rows by their reference counts, both ways", async ({
  page,
}) => {
  await page.goto(dependenciesUrl);
  await sortButton(page, "Evidence").click();
  const ascending = (await rows(page)).map((r) => r.references);
  expect(ascending.every(Number.isFinite)).toBe(true);
  expect(ascending).toEqual([...ascending].sort((a, b) => a - b));

  await sortButton(page, "Evidence").click();
  await expect(
    page.getByRole("columnheader", { name: "Evidence" })
  ).toHaveAttribute("aria-sort", "descending");
  const descending = (await rows(page)).map((r) => r.references);
  expect(descending).toEqual([...descending].sort((a, b) => b - a));
  expect(descending[0]).toBeGreaterThan(ascending[0]);
});

test("changing the sort returns to the first page", async ({ page }) => {
  await page.goto(dependenciesUrl);
  await pagination(page)
    .getByRole("button", { name: "Go to next page" })
    .click();
  await expect(pagination(page).locator('[aria-current="page"]')).toHaveText(
    "2"
  );

  await sortButton(page, "Scope").click();
  await expect(pagination(page).locator('[aria-current="page"]')).toHaveText(
    "1"
  );
});
