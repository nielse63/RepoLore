import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * Major Area lists are ranked for orientation (GitHub issue #48), not listed
 * alphabetically: implementation areas before tests/test-support/tooling,
 * then by direct relationships (depends on + imported by), descending.
 * Reads `nielse63/RepoLore` — this repository's own tree, persisted by `npm
 * run seed:e2e` — which has several pages of areas and whose alphabetically
 * first area (`/e2e`) is a test area with almost no relationships. Each
 * assertion is checked against the counts the page itself displays.
 */

const repoUrl = "/lore/nielse63/RepoLore";
const ORDER_NOTE =
  "Ordered by detected direct relationships (depends on + imported by), then entry points, then name; tests and tooling configuration are listed last.";
const NON_PRIMARY = new Set([
  "Tests",
  "Test fixtures/support data",
  "Build/tooling configuration",
]);

interface ListedArea {
  name: string;
  nonPrimary: boolean;
  relationships: number;
}

/** Implementation areas first, then non-increasing relationships within each group. */
function expectRanked(areas: ListedArea[]) {
  const groups = areas.map((a) => a.nonPrimary);
  expect(groups).toEqual([...groups].sort());
  for (const nonPrimary of [false, true]) {
    const counts = areas
      .filter((a) => a.nonPrimary === nonPrimary)
      .map((a) => a.relationships);
    expect(counts).toEqual([...counts].sort((x, y) => y - x));
  }
}

/**
 * Reads the areas behind Overview cards / Architecture rows from what each
 * one displays: its name link, its description (the responsibility, when
 * one was detected), and its "Depends on" / "Imported By" counts.
 */
async function listedAreas(nameLinks: Locator): Promise<ListedArea[]> {
  return nameLinks.evaluateAll(
    (links, nonPrimary) =>
      links.map((link) => {
        const item = link.closest(":has(> dl)")!;
        const count = (label: string) =>
          Number(
            [...item.querySelectorAll("dt")].find(
              (dt) => dt.textContent === label
            )?.nextElementSibling?.textContent
          );
        return {
          // Drop `SourceLink`'s screen-reader-only new-tab suffix.
          name: (link.textContent ?? "").replace(" (opens in a new tab)", ""),
          nonPrimary: nonPrimary.includes(
            item.querySelector("p")?.textContent ?? ""
          ),
          relationships: count("Depends on") + count("Imported By"),
        };
      }),
    [...NON_PRIMARY]
  );
}

const overviewNameLinks = (page: Page) => page.locator("#major-areas h3 a");

test("the Overview's Major Areas are ranked by relationships, tests last, across every page", async ({
  page,
}) => {
  await page.goto(repoUrl);
  await expect(page.locator("#major-areas")).toContainText(ORDER_NOTE);

  const pageCount = await page
    .locator("#major-areas")
    .getByRole("navigation", { name: "Pagination" })
    .getByRole("button", { name: /^\d+$/ })
    .count();
  expect(pageCount).toBeGreaterThan(1);

  const areas: ListedArea[] = [];
  for (let n = 1; n <= pageCount; n++) {
    await page.goto(n === 1 ? repoUrl : `${repoUrl}?page=${n}`);
    await expect(overviewNameLinks(page).first()).toBeVisible();
    areas.push(...(await listedAreas(overviewNameLinks(page))));
  }

  expect(areas[0]).toMatchObject({ nonPrimary: false });
  expect(areas[0].name).not.toBe("/e2e");
  expect(areas.find((a) => a.name === "/e2e")).toMatchObject({
    nonPrimary: true,
  });
  expectRanked(areas);
});

async function systemsPageAreas(page: Page): Promise<ListedArea[]> {
  return page
    .getByRole("main")
    .getByRole("listitem")
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => {
        const texts = [...link.querySelectorAll("p")].map(
          (p) => p.textContent ?? ""
        );
        return {
          name: texts[0],
          nonPrimary: !link.textContent!.includes("Implementation area"),
          relationships: Number(texts[texts.indexOf("Relationships") + 1]),
        };
      })
    );
}

test("the Systems list is ranked the same way, and filtering keeps that order", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/systems`);
  await expect(page.getByText(ORDER_NOTE)).toBeVisible();

  const pagination = page
    .getByRole("main")
    .getByRole("navigation", { name: "Pagination" });
  const pageCount = await pagination
    .getByRole("button", { name: /^\d+$/ })
    .count();
  expect(pageCount).toBeGreaterThan(1);

  const areas: ListedArea[] = [];
  for (let n = 1; n <= pageCount; n++) {
    await pagination
      .getByRole("button", { name: String(n), exact: true })
      .click();
    await expect(
      pagination.getByRole("button", { name: String(n), exact: true })
    ).toHaveAttribute("aria-current", "page");
    areas.push(...(await systemsPageAreas(page)));
  }
  expect(areas.length).toBeGreaterThan(6);
  expect(areas[0]).toMatchObject({ nonPrimary: false });
  expectRanked(areas);

  // Search filters the ranked list rather than restoring alphabetical order.
  await page.getByLabel("Search systems").fill("src/analysis");
  const searched = await systemsPageAreas(page);
  expect(searched.length).toBeGreaterThan(1);
  expect(searched.map((a) => a.name)).toEqual(
    areas
      .filter((a) => a.name.includes("src/analysis"))
      .slice(0, searched.length)
      .map((a) => a.name)
  );

  // The top-ranked system's link still resolves to that system's subview.
  await page.getByLabel("Search systems").fill("");
  await page
    .getByRole("main")
    .getByRole("listitem")
    .getByRole("link")
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: areas[0].name })
  ).toBeVisible();
});

test("the Architecture page's Major Areas list is ranked the same way", async ({
  page,
}) => {
  await page.goto(repoUrl);
  const overviewFirstPage = await listedAreas(overviewNameLinks(page));

  await page.goto(`${repoUrl}/architecture`);
  const list = page
    .getByRole("heading", { name: "Major Areas" })
    .locator("xpath=..");
  await expect(list).toContainText(ORDER_NOTE);
  const firstPage = await listedAreas(
    list.getByRole("listitem").getByRole("link")
  );

  expect(firstPage[0]).toMatchObject({ nonPrimary: false });
  expect(firstPage.map((a) => a.name)).not.toContain("/e2e");
  expectRanked(firstPage);
  expect(firstPage).toEqual(overviewFirstPage);
});
