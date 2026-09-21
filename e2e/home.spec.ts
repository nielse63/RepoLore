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

test("shows an honest inline error for an invalid owner/repo shorthand", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("GitHub repository URL").fill("-bad-/repo");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(
    page.getByText("“-bad-” isn’t a valid GitHub owner name.")
  ).toBeVisible();
});

test("shows a staged loading view while the Server Action is pending", async ({
  page,
}) => {
  // Delays the browser's dispatch of the form's POST (the Server Action
  // invocation) so the pending window is long enough to assert against,
  // without needing GITHUB_TOKEN/a database — the delay happens before the
  // request ever reaches the server, so this works regardless of which
  // branch (validation error vs. real analysis) handles it.
  await page.route("/", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByText("Fetching repository source…")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Understand any codebase with confidence.",
    })
  ).toBeHidden();

  // Resolves back to the form with the pre-analysis validation error, since
  // this test submits an empty URL.
  await expect(page.getByText("A GitHub URL is required.")).toBeVisible();
  await expect(page.getByRole("status")).toBeHidden();
});

test("advances through each fixed analysis stage on its 2.5s cadence", async ({
  page,
}) => {
  // Fakes the page's timers so the 2.5s-apart stage transitions can be
  // asserted without a real wall-clock wait. The POST is held open
  // indefinitely (rather than delayed by a fixed amount, as in the test
  // above) since we don't know in advance how long this test needs to keep
  // the loading view on screen.
  await page.clock.install();

  let resolvePost: () => void = () => {};
  const postHeld = new Promise<void>((resolve) => {
    resolvePost = resolve;
  });
  await page.route("/", async (route) => {
    if (route.request().method() === "POST") {
      await postHeld;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  await expect(page.getByText("Fetching repository source…")).toBeVisible();

  await page.clock.fastForward(2_600);
  await expect(page.getByText("Analyzing code…")).toBeVisible();

  await page.clock.fastForward(2_600);
  await expect(page.getByText("Building your Lore…")).toBeVisible();

  resolvePost();
  await expect(page.getByText("A GitHub URL is required.")).toBeVisible();
});

// getDelayAfterStage (src/lib/analysis-loading-stages.ts) randomizes each
// reassurance-stage delay to 30-45s, but which message comes next is not
// randomized — only how long it lingers is. Fast-forwarding by the max
// (with a safety margin) guarantees crossing that delay regardless of the
// actual random value drawn, so the next message is still deterministic.
const REASSURANCE_STEP_MS = 45_100;

test("shows a looping, generic reassurance message once the fixed stages are exhausted", async ({
  page,
}) => {
  await page.clock.install();

  let resolvePost: () => void = () => {};
  const postHeld = new Promise<void>((resolve) => {
    resolvePost = resolve;
  });
  await page.route("/", async (route) => {
    if (route.request().method() === "POST") {
      await postHeld;
    }
    await route.continue();
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Analyze repository" }).click();

  // Skip past the two fixed stages that precede "Building your Lore…".
  await page.clock.fastForward(2_600);
  await page.clock.fastForward(2_600);
  await expect(page.getByText("Building your Lore…")).toBeVisible();

  await page.clock.fastForward(REASSURANCE_STEP_MS);
  await expect(page.getByText("Still working…")).toBeVisible();

  await page.clock.fastForward(REASSURANCE_STEP_MS);
  await expect(page.getByText("This can take a minute or two…")).toBeVisible();

  await page.clock.fastForward(REASSURANCE_STEP_MS);
  await expect(page.getByText("Almost there…")).toBeVisible();

  // Loops back to the first reassurance message rather than freezing once
  // the sequence is exhausted.
  await page.clock.fastForward(REASSURANCE_STEP_MS);
  await expect(page.getByText("Still working…")).toBeVisible();

  resolvePost();
  await expect(page.getByText("A GitHub URL is required.")).toBeVisible();
});

test("focuses the repository URL input on page load", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#url")).toBeFocused();
});

test("has canonical and social-sharing metadata", async ({ page }) => {
  await page.goto("/");

  // Asserts the path, not just "some origin + /" — Playwright runs against
  // localhost itself, so a regex matching any origin can't distinguish a
  // correctly configured canonical from siteMetadataBase()'s localhost
  // fallback (src/lib/route-metadata.ts).
  const canonical = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  expect(new URL(canonical!).pathname).toBe("/");
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
