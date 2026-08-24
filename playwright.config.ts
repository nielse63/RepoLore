import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:3000";

/**
 * Functional/UI test suite (implementation-plan.md session 15), scoped to
 * pages that need no external services: the home page's client-side URL
 * validation and the `/fixtures/*` pages, which run a real analyzer against
 * a local fixture at request time with no GitHub token or database
 * required. `reuseExistingServer` (local only) reuses a `next dev` a
 * developer already has running rather than failing to start a second one —
 * Next.js refuses to run two dev servers against the same directory.
 *
 * `screenshot: "only-on-failure"` attaches a screenshot to each failing test,
 * viewable in the `html` reporter's own report (`npx playwright show-report`).
 * The `monocart-reporter` entry only collects V8 coverage (see `e2e/coverage.ts`)
 * into `coverage/e2e/` — it doesn't replace the `html` reporter above.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    [
      "monocart-reporter",
      {
        name: "Repo Lore Playwright Coverage Report",
        outputFile: "./coverage/e2e/report.html",
        coverage: {
          outputDir: "./coverage/e2e",
          entryFilter: (entry: { url: string }) =>
            entry.url.includes("/_next/static/"),
          sourceFilter: (sourcePath: string) => sourcePath.startsWith("src/"),
          lcov: true,
        },
      },
    ],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
