import { test, expect } from "./coverage";

/**
 * `/fixtures/*` functional coverage (implementation-plan.md session 15).
 * These pages run a real analyzer (`extractJsTsProject`/`extractPythonProject`
 * + derived views) against a local fixture directory at request time — no
 * GitHub token or database required — so they're the one place the full
 * Lore rendering (`LoreView`) can be driven end-to-end in the browser
 * without external services.
 */

const FIXTURE_NAMES = [
  "ts-react-app",
  "ts-library",
  "python-app",
  "python-library",
] as const;

test("fixtures index links to every fixture", async ({ page }) => {
  await page.goto("/fixtures");

  await expect(page.getByRole("heading", { name: "Fixtures" })).toBeVisible();
  for (const name of FIXTURE_NAMES) {
    await expect(page.getByRole("link", { name })).toHaveAttribute(
      "href",
      `/fixtures/${name}`
    );
  }
});

for (const name of FIXTURE_NAMES) {
  test(`/fixtures/${name} renders a full Lore view`, async ({ page }) => {
    await page.goto(`/fixtures/${name}`);

    await expect(
      page.getByRole("heading", { name: `fixtures/${name}` })
    ).toBeVisible();

    for (const section of [
      "Analysis",
      "Start Here",
      "Major Areas",
      "Entry Points",
      "Direct Relationships",
      "Gaps",
    ]) {
      await expect(page.getByRole("heading", { name: section })).toBeVisible();
    }

    await expect(page.getByText("Analyzer version:")).toBeVisible();
  });
}

test("an unknown fixture name 404s", async ({ page }) => {
  const response = await page.goto("/fixtures/does-not-exist");
  expect(response?.status()).toBe(404);
});
