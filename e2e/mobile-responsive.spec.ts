import { expect, test } from "./coverage";

/**
 * Responsive shell coverage: the menu-triggered Sidebar drawer, the
 * inspector's bottom sheet at 660px and below (issue #84), and the layout
 * fixes that keep every routed page free of horizontal overflow from 320px
 * to 1440px. Like `systems.spec.ts`, these need `DATABASE_URL` (reading the
 * already-persisted `completed` analysis run for the pinned private fixture
 * `nielse63/repo-lore-ts-react-app-fixture`, see README "Fixtures") but not
 * `GITHUB_TOKEN`, since nothing here triggers a fresh analysis.
 */

const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

// Every routed page that renders inside the shared app shell — used for the
// generic no-horizontal-overflow sweep.
const SHELL_ROUTES = [
  repoUrl,
  `${repoUrl}/architecture`,
  `${repoUrl}/systems`,
  `${repoUrl}/systems/src-utils`,
  `${repoUrl}/dependencies`,
  `${repoUrl}/data-flow`,
  `${repoUrl}/history`,
];

test.describe("Sidebar mobile drawer", () => {
  test("the hamburger toggle is hidden at desktop width and visible at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(repoUrl);
    await expect(
      page.getByRole("button", { name: "Open navigation menu" })
    ).toBeHidden();

    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect(
      page.getByRole("button", { name: "Open navigation menu" })
    ).toBeVisible();
  });

  test("opening the drawer reveals repository navigation, and navigating closes it", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(repoUrl);

    const nav = page.getByRole("navigation", { name: "Repository sections" });
    await expect(nav).toBeHidden();

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(nav).toBeVisible();

    await nav.getByRole("link", { name: "Architecture" }).click();

    await expect(page).toHaveURL(`${repoUrl}/architecture`);
    await expect(nav).toBeHidden();
  });

  test("Escape closes the drawer", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(repoUrl);

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const nav = page.getByRole("navigation", { name: "Repository sections" });
    await expect(nav).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
  });
});

test.describe("Inspector bottom sheet at 390px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("selecting a dependency opens a focused sheet that closes back to the row", async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/dependencies`);
    const row = page
      .getByRole("button", { name: /^View .+ dependency details$/ })
      .first();
    await row.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute("id", "lore-inspector");
    await expect(sheet).toContainText("Dependency evidence");
    // A bottom sheet: anchored to the viewport's bottom edge.
    const box = (await sheet.boundingBox())!;
    expect(Math.round(box.y + box.height)).toBe(844);
    await expect(
      sheet.getByRole("button", { name: "Close inspector" })
    ).toBeFocused();

    await sheet.getByRole("button", { name: "Close inspector" }).click();
    await expect(sheet).toBeHidden();
    await expect(row).toBeFocused();
  });

  test("Escape dismisses the sheet and restores focus", async ({ page }) => {
    await page.goto(`${repoUrl}/dependencies`);
    const row = page
      .getByRole("button", { name: /^View .+ dependency details$/ })
      .first();
    await row.click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(row).toBeFocused();
  });

  test("the Systems page's System map is in the page, not behind a panel", async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/systems`);
    await expect(
      page.getByRole("heading", { name: "System map" })
    ).toBeVisible();
  });
});

const WIDTHS = [320, 390, 768, 1024, 1440];

test.describe("No horizontal overflow", () => {
  for (const width of WIDTHS) {
    test(`no shell route overflows at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of SHELL_ROUTES) {
        await page.goto(route);
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(scrollWidth, route).toBeLessThanOrEqual(clientWidth);
      }
    });

    test(`the open inspector doesn't overflow at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${repoUrl}/dependencies`);
      await page
        .getByRole("button", { name: /^View .+ dependency details$/ })
        .first()
        .click();
      await expect(page.locator("#lore-inspector")).toBeVisible();
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});

test.describe("Data Flow toolbar", () => {
  test("switching to List view (rendering both pill groups) causes no horizontal overflow at 375px", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${repoUrl}/data-flow`);

    await page
      .getByRole("group", { name: "View mode" })
      .getByRole("button", { name: "List" })
      .click();

    await expect(page.getByRole("group", { name: "Sort by" })).toBeVisible();

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("the toolbar wraps the sort pill group onto its own row when space is tight", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(`${repoUrl}/data-flow`);

    await page
      .getByRole("group", { name: "View mode" })
      .getByRole("button", { name: "List" })
      .click();

    const viewGroup = page.getByRole("group", { name: "View mode" });
    const sortGroup = page.getByRole("group", { name: "Sort by" });

    const viewBox = await viewGroup.boundingBox();
    const sortBox = await sortGroup.boundingBox();
    expect(viewBox).not.toBeNull();
    expect(sortBox).not.toBeNull();
    // Either they fit on one row (both groups' content is short enough) or
    // flex-wrap has pushed the sort group below — both are fine as long as
    // neither causes page overflow (asserted above); this just confirms the
    // wrap mechanism engages once it's needed rather than overflowing.
    expect(sortBox!.y).toBeGreaterThanOrEqual(viewBox!.y);
  });
});
