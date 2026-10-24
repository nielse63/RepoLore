import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * The Area → "Depends on" relationships table (Architecture's Component
 * Connections, Dependencies' Internal tab) is paginated like the other Lore
 * lists. Reads `nielse63/RepoLore` (persisted by `npm run seed:e2e`), whose
 * Major Areas have far more direct relationships than fit on one page.
 */

const repoUrl = "/lore/nielse63/RepoLore";

/** Each body row as "from → to", read from its first two cells. */
async function rowKeys(scope: Locator): Promise<string[]> {
  return scope.locator("tbody tr").evaluateAll((rows) =>
    rows.map((row) =>
      [...row.querySelectorAll("td")]
        .slice(0, 2)
        .map((td) =>
          (td.textContent ?? "").replace(" (opens in a new tab)", "")
        )
        .join(" → ")
    )
  );
}

/**
 * Walks every page with "Next", asserting each page holds at most the first
 * page's row count and no row appears twice; returns every row seen.
 */
async function walkAllPages(page: Page, scope: Locator): Promise<string[]> {
  const nav = scope.getByRole("navigation", { name: "Pagination" });
  const next = nav.getByRole("button", { name: "Go to next page" });
  await expect(nav.locator('[aria-current="page"]')).toHaveText("1");

  const firstPage = await rowKeys(scope);
  expect(firstPage.length).toBeGreaterThanOrEqual(5);
  expect(firstPage.length).toBeLessThanOrEqual(15);

  const seen = [...firstPage];
  for (let n = 2; await next.isEnabled(); n++) {
    await next.click();
    await expect(nav.locator('[aria-current="page"]')).toHaveText(String(n));
    const rows = await rowKeys(scope);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(firstPage.length);
    seen.push(...rows);
  }
  expect(seen.length).toBeGreaterThan(firstPage.length);
  expect(new Set(seen).size).toBe(seen.length);
  return seen;
}

test("Architecture's Component Connections table is paginated and remembers its page", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/architecture`);
  const section = page.locator("#component-connections");
  const nav = section.getByRole("navigation", { name: "Pagination" });

  // The page is remembered for the tab session. Page 2 rather than a later
  // one: a reload restores the scroll position, so the fit-to-screen page
  // size (and with it the page count) can differ from the first load.
  await nav.getByRole("button", { name: "Go to next page" }).click();
  await expect(nav.locator('[aria-current="page"]')).toHaveText("2");
  await page.reload();
  await expect(nav.locator('[aria-current="page"]')).toHaveText("2");
  await nav.getByRole("button", { name: "Go to previous page" }).click();

  await walkAllPages(page, section);
});

test("the Dependencies page's Internal tab paginates the same relationships", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/architecture`);
  const architectureRows = await walkAllPages(
    page,
    page.locator("#component-connections")
  );

  await page.goto(`${repoUrl}/dependencies`);
  await page.getByRole("tab", { name: /internal/i }).click();
  const panel = page.getByRole("tabpanel");
  const internalRows = await walkAllPages(page, panel);
  expect([...internalRows].sort()).toEqual([...architectureRows].sort());
});
