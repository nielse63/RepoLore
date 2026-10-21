import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * The Overview's Major Areas grid, paginated through the URL (`?page=N`) so
 * the server renders only the current page's cards (`PaginatedCardGrid`).
 * Pagination needs more than one page of Major Areas (6 per page), which the
 * pinned fixtures don't have, so this uses the smallest such Lore `/explore`
 * lists — needs `DATABASE_URL` with at least one seeded repository (see
 * `npm run seed`).
 */

const PAGE_SIZE = 6;

async function findPaginatedLore(page: Page) {
  await page.goto("/explore");
  const cards = await page
    .getByRole("main")
    .getByRole("listitem")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href") ?? "",
        areas: Number(link.textContent?.match(/(\d+) major areas?/)?.[1] ?? 0),
      }))
    );
  const lore = cards
    .filter((card) => card.areas > PAGE_SIZE)
    .sort((a, b) => a.areas - b.areas)[0];
  expect(
    lore,
    "/explore should list a Lore with more than one page of Major Areas"
  ).toBeDefined();
  return lore!;
}

const areaHeadings = (page: Page) => page.locator("#major-areas h3");
const pagination = (page: Page) =>
  page.locator("#major-areas").getByRole("navigation", { name: "Pagination" });

test("changing page navigates to ?page=N and shows that page's areas", async ({
  page,
}) => {
  const lore = await findPaginatedLore(page);

  await page.goto(lore.href);
  await expect(areaHeadings(page)).toHaveCount(PAGE_SIZE);
  const firstPage = await areaHeadings(page).allTextContents();

  await pagination(page)
    .getByRole("button", { name: "Go to next page" })
    .click();
  await expect(page).toHaveURL(`${lore.href}?page=2`);
  await expect(
    pagination(page).getByRole("button", { name: "2", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(areaHeadings(page)).not.toHaveText(firstPage);

  await pagination(page)
    .getByRole("button", { name: "1", exact: true })
    .click();
  await expect(page).toHaveURL(lore.href);
  await expect(areaHeadings(page)).toHaveText(firstPage);
});

test("an out-of-range ?page= shows the last page instead of an empty one", async ({
  page,
}) => {
  const lore = await findPaginatedLore(page);

  const lastPage = Math.ceil(lore.areas / PAGE_SIZE);
  await page.goto(`${lore.href}?page=9999`);

  await expect(
    pagination(page).getByRole("button", {
      name: String(lastPage),
      exact: true,
    })
  ).toHaveAttribute("aria-current", "page");
  await expect(areaHeadings(page)).toHaveCount(
    lore.areas - (lastPage - 1) * PAGE_SIZE
  );
});
