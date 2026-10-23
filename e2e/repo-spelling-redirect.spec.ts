import { expect, test } from "./coverage";

/**
 * A `/lore/{owner}/{repo}` URL spelled with different letter case than the
 * stored repository (GitHub issue #43) redirects to the stored spelling's
 * Lore, rather than rendering a separate "not analyzed" Lore whose Analyze
 * button would create a duplicate. A DB-only lookup — needs `DATABASE_URL`
 * (`npm run seed:e2e` persists `nielse63/RepoLore`) but not `GITHUB_TOKEN`.
 */

const stored = "nielse63/RepoLore";

test("a case-variant Overview URL redirects to the stored spelling's Lore", async ({
  page,
}) => {
  await page.goto("/lore/NIELSE63/repolore");
  await expect(page).toHaveURL(new RegExp(`/lore/${stored}$`));
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /hasn't been analyzed yet/ })
  ).toHaveCount(0);
});

test("a case-variant subpage URL redirects to the same subpage of the stored spelling", async ({
  page,
}) => {
  await page.goto("/lore/nielse63/repolore/architecture");
  await expect(page).toHaveURL(new RegExp(`/lore/${stored}/architecture$`));
  await expect(
    page.getByRole("heading", { name: "Architecture", level: 1 })
  ).toBeVisible();
});

test("a swapped GitHub URL with different case lands on the stored spelling's Lore", async ({
  page,
}) => {
  await page.goto("/nielse63/repolore");
  await expect(page).toHaveURL(new RegExp(`/lore/${stored}$`));
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});
