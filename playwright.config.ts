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
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
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
