import { expect, test } from "./coverage";

/**
 * "Swap github.com for repolore.app" coverage (`src/app/[...path]/page.tsx`)
 * and the unanalyzed-repository Overview (`NotAnalyzedPanel`). Needs
 * `DATABASE_URL` (the pinned fixture `nielse63/repo-lore-ts-react-app-fixture`
 * has a persisted run; `unanalyzed` never does) but not `GITHUB_TOKEN`: the
 * "Analyze" button itself isn't clicked, since that runs a real analysis.
 */

const fixture = "nielse63/repo-lore-ts-react-app-fixture";
const unanalyzed = "nielse63/repo-lore-never-analyzed-e2e";

test("a swapped GitHub URL redirects to the repository's Lore, ignoring ref/path segments", async ({
  page,
}) => {
  await page.goto(`/${fixture}/tree/main/src`);
  await expect(page).toHaveURL(new RegExp(`/lore/${fixture}$`));
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("a github.com-prefixed path redirects to the repository's Lore", async ({
  page,
}) => {
  await page.goto(`/github.com/${fixture}`);
  await expect(page).toHaveURL(new RegExp(`/lore/${fixture}$`));
});

test("paths that aren't a valid owner/repo still 404", async ({ page }) => {
  for (const path of ["/lore/only-owner", "/-bad-owner/repo"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible();
  }
});

test("an unanalyzed repository offers an explicit Analyze button, noindex, without analyzing on load", async ({
  page,
}) => {
  let submitted = false;
  page.on("request", (request) => {
    if (request.method() === "POST") submitted = true;
  });

  await page.goto(`/${unanalyzed}`);
  await expect(page).toHaveURL(new RegExp(`/lore/${unanalyzed}$`));
  await expect(
    page.getByRole("heading", {
      name: `${unanalyzed} hasn't been analyzed yet`,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Analyze ${unanalyzed}` })
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow"
  );
  await expect(page.getByRole("navigation", { name: "Site" })).toBeVisible();
  expect(submitted).toBe(false);

  await page.goto(`/lore/${unanalyzed}/architecture`);
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
});
