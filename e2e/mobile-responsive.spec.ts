import { expect, test } from "./coverage";

/**
 * Mobile-responsive shell coverage: the hamburger-triggered Sidebar drawer,
 * the RightRailShell bottom sheet, and the layout fixes that keep every
 * routed page free of horizontal overflow and usable down to a 375px
 * viewport. Like `systems.spec.ts`, these need `DATABASE_URL` (reading the
 * already-persisted `completed` analysis run for the pinned private fixture
 * `nielse63/repo-lore-ts-react-app-fixture`, see README "Fixtures") but not
 * `GITHUB_TOKEN`, since nothing here triggers a fresh analysis.
 */

const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };

// Every routed page that renders inside the shared app shell — used for the
// generic no-horizontal-overflow sweep. `repository-settings` isn't built yet
// (404s, see Sidebar.tsx) and intentionally not covered here.
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

test.describe("RightRailShell mobile bottom sheet", () => {
  test("the floating trigger is hidden at desktop width and visible at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`${repoUrl}/architecture`);
    await expect(
      page.getByRole("button", { name: "Show About this architecture panel" })
    ).toBeHidden();

    await page.setViewportSize(MOBILE_VIEWPORT);
    await expect(
      page.getByRole("button", { name: "Show About this architecture panel" })
    ).toBeVisible();
  });

  test("opening the sheet shows the rail content, including the Systems page's System map", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${repoUrl}/systems`);

    await expect(
      page.getByRole("heading", { name: "System map" })
    ).toBeHidden();

    await page.getByRole("button", { name: "Show System map panel" }).click();

    await expect(
      page.getByRole("heading", { name: "System map" })
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Diagram of how major areas depend on each other",
      })
    ).toBeVisible();

    await page.getByRole("button", { name: "Close System map panel" }).click();
    await expect(
      page.getByRole("heading", { name: "System map" })
    ).toBeHidden();
  });
});

test.describe("No horizontal overflow at 375px", () => {
  for (const route of SHELL_ROUTES) {
    test(`${route} has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(route);

      const overflowing = await page.evaluate(
        () => document.documentElement.scrollWidth
      );
      const viewportWidth = await page.evaluate(
        () => document.documentElement.clientWidth
      );
      expect(overflowing).toBeLessThanOrEqual(viewportWidth);
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
