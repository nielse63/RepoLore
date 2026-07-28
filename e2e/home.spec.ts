import { test, expect } from "@playwright/test";

/**
 * Home page functional coverage (implementation-plan.md session 15). Only
 * exercises the client-side/pre-analysis validation path in
 * `parseGitHubRepoUrl` (`src/github/parse-repo-url.ts`) — inputs that fail
 * before the Server Action ever calls the GitHub API — so this suite needs
 * no `GITHUB_TOKEN` or database.
 */

test("renders the hero and repository URL form", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Understand any codebase with confidence.",
    })
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("https://github.com/owner/repository")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Analyze repository" })
  ).toBeVisible();
});

test("shows an honest inline error for an empty submission", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.getByText("Enter a GitHub repository URL.")).toBeVisible();
});

test("shows an honest inline error for a non-GitHub URL", async ({ page }) => {
  await page.goto("/");

  await page
    .getByLabel("GitHub repository URL")
    .fill("https://example.com/owner/repo");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(
    page.getByText("Only github.com repository URLs are supported.")
  ).toBeVisible();
});
