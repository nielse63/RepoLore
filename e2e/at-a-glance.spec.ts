import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * The Overview's "At a glance" block (GitHub issue #59): the mission's first
 * orientation questions — what kind of system is this, where does execution
 * probably begin — answered above Start Here from facts already in the
 * persisted Lore, each with its certainty. Reads the runs `npm run seed:e2e`
 * persists (needs `DATABASE_URL`, not `GITHUB_TOKEN`): the pinned
 * `ts-react-app` fixture (an application with a detected bootstrap), the
 * `ts-nested-test-samples` fixture (a library), and this repository's own
 * tree (Next.js routes only — no bootstrap, CLI, or library entry point),
 * the local-only `mixed-ts-python` fixture (a TypeScript library and a
 * Python CLI analyzed as two language projects, ADR-0007), and the
 * local-only `js-partial` fixture (a single-file project persisted as
 * `'partial'`).
 */

const glance = (page: Page) =>
  page.getByRole("region", { name: "At a glance" });
const glanceLine = (page: Page, id: string) =>
  glance(page).locator(`li[data-line="${id}"]`);

test("an application's Overview opens with its kind, bootstrap entry point, and most-connected areas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/lore/nielse63/repo-lore-ts-react-app-fixture");

  // Kind is a heuristic over entry-point shape, stored as Inferred — never
  // presented as Detected.
  await expect(glanceLine(page, "kind")).toHaveText(
    "repo-lore-ts-react-app-fixture is a TypeScript application Inferred, because a bootstrap or command-line entry point was found at /src/index.tsx (opens in a new tab)"
  );
  await expect(glanceLine(page, "entry")).toHaveText(
    "Its application bootstrap entry point is /src/index.tsx (opens in a new tab) Detected"
  );
  await expect(glanceLine(page, "areas")).toHaveText(
    "The areas with the most detected direct relationships (depends on + imported by) are /src/components (opens in a new tab) (2), /src (opens in a new tab) (1) and /src/utils (opens in a new tab) (1)."
  );
  await expect(glanceLine(page, "counts")).toHaveText(
    "3 major areas · 3 external dependencies (2 production) · 0 recorded gaps"
  );

  // The entry link leads to that file at the analyzed commit.
  await expect(
    glanceLine(page, "entry").getByRole("link", { name: /\/src\/index\.tsx/ })
  ).toHaveAttribute(
    "href",
    "https://github.com/nielse63/repo-lore-ts-react-app-fixture/blob/50857b9860ee568f54a6707098761857932ab02f/src/index.tsx"
  );

  // It sits above Start Here, within the first 1440×900 screen.
  const glanceBox = (await glance(page).boundingBox())!;
  const startHereBox = (await page.locator("#start-here").boundingBox())!;
  expect(glanceBox.y + glanceBox.height).toBeLessThanOrEqual(startHereBox.y);
  expect(glanceBox.y + glanceBox.height).toBeLessThanOrEqual(900);
});

test("a library's Overview names its declared public entry point and leaves its packages/core/tests suite out of the connected areas", async ({
  page,
}) => {
  await page.goto("/lore/nielse63/repo-lore-ts-nested-test-samples-fixture");

  await expect(glanceLine(page, "kind")).toContainText(
    "repo-lore-ts-nested-test-samples-fixture is a TypeScript/JavaScript library Inferred"
  );
  await expect(glanceLine(page, "entry")).toHaveText(
    "Its declared public entry point is /packages/core/src/index.ts (opens in a new tab) Detected"
  );
  await expect(glanceLine(page, "areas")).toHaveText(
    "The areas with the most detected direct relationships (depends on + imported by) are /packages/core/src (opens in a new tab) (2) and /packages/test (opens in a new tab) (1)."
  );
});

test("an Overview with no starting entry point says so as Unknown and links to the entry points it has", async ({
  page,
}) => {
  await page.goto("/lore/nielse63/RepoLore");

  const entry = glanceLine(page, "entry");
  await expect(entry).toContainText(
    "No bootstrap, command-line, library, or runtime entry point was detected Unknown"
  );
  await entry.getByRole("link", { name: /other entry points/ }).click();
  await expect(page).toHaveURL(/#entry-points$/);

  // The counts line's recorded gaps link to the Gaps section.
  const counts = glanceLine(page, "counts");
  const gapCount = Number(
    (await counts.textContent())!.match(/(\d+) recorded gaps?/)![1]
  );
  expect(gapCount).toBeGreaterThan(0);
  await counts.getByRole("link", { name: "View gaps" }).click();
  await expect(page).toHaveURL(/#gaps$/);
  await expect(page.locator("#gaps")).toBeInViewport();
});

test("a mixed-language Overview gives each language project its own kind and entry point row", async ({
  page,
}) => {
  await page.goto("/lore/nielse63/repo-lore-mixed-ts-python-fixture");

  const kind = glanceLine(page, "kind");
  await expect(kind).toContainText("Analyzed as 2 language projects:");
  await expect(kind.locator("[data-project-clause]")).toHaveText([
    'The TypeScript project is a library Inferred, because /package.json (opens in a new tab) declares "main" or "exports" and no bootstrap, CLI, UI framework dependency, or React components were found',
    "The Python project is an application Inferred, because a bootstrap or command-line entry point was found at /tool/cli.py (opens in a new tab)",
  ]);
  // Seeded per project, as Start Here is: the Python CLI doesn't hide the
  // TypeScript library's entry point.
  await expect(
    glanceLine(page, "entry").locator("[data-project-clause]")
  ).toHaveText([
    "The TypeScript project's declared public entry point is /src/index.ts (opens in a new tab) Detected",
    "The Python project's command-line entry point is /tool/cli.py (opens in a new tab) Detected",
  ]);

  // One row per project, not one run-on line.
  const rows = kind.locator("[data-project-clause]");
  const first = (await rows.nth(0).boundingBox())!;
  const second = (await rows.nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
});

test("a partial run's Overview shows the partial warning before the summary, and why its kind is assumed", async ({
  page,
}) => {
  await page.goto("/lore/nielse63/repo-lore-js-partial-fixture");

  const warning = page.locator("#partial-understanding-card");
  await expect(warning).toContainText("Understanding is partial");
  const warningBox = (await warning.boundingBox())!;
  const glanceBox = (await glance(page).boundingBox())!;
  expect(warningBox.y + warningBox.height).toBeLessThanOrEqual(glanceBox.y);

  await expect(glanceLine(page, "kind")).toHaveText(
    'repo-lore-js-partial-fixture is a JavaScript application Inferred, assumed because /package.json (opens in a new tab) declares neither "main" nor "exports"'
  );
  await expect(glanceLine(page, "entry")).toHaveText(
    "Its conventional runtime entry point is /index.js (opens in a new tab) Inferred"
  );
  await expect(glanceLine(page, "areas")).toHaveText(
    "No major areas were identified Unknown"
  );
});
