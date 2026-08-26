import { expect, test } from "./coverage";

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

test("explains scope and what analysis produces near the form", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByText("Works with any public GitHub repository", {
      exact: false,
    })
  ).toBeVisible();
  await expect(
    page.getByText("evidence-backed Overview, Architecture", {
      exact: false,
    })
  ).toBeVisible();
});

test("shows an honest inline error for an empty submission", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.getByText("A GitHub URL is required.")).toBeVisible();
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

test("focuses the repository URL input on page load", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#url")).toBeFocused();
});

test("has canonical and social-sharing metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https?:\/\/[^/]+\/?$/
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    /Repo Lore/
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image"
  );
});

test("has no broken same-origin links", async ({ page, request }) => {
  await page.goto("/");

  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((anchors) =>
      anchors
        .map((a) => a.getAttribute("href"))
        .filter((href): href is string => !!href)
    );

  const sameOriginPaths = hrefs.filter(
    (href) =>
      !href.startsWith("#") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:") &&
      !/^[a-z]+:\/\//i.test(href)
  );

  for (const path of sameOriginPaths) {
    const response = await request.get(path);
    expect(response.status(), `link "${path}" should not error`).toBeLessThan(
      400
    );
  }
});

test("loads with no failed asset requests or console errors", async ({
  page,
}) => {
  const failedRequests: string[] = [];
  const consoleErrors: string[] = [];

  page.on("requestfailed", (req) => {
    failedRequests.push(
      `${req.url()} (${req.failure()?.errorText ?? "unknown error"})`
    );
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`${res.url()} (${res.status()})`);
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto("/");
  await page.waitForLoadState("load");

  expect(failedRequests, "no asset/network requests should fail").toEqual([]);
  expect(consoleErrors, "no console errors should be logged").toEqual([]);
});
