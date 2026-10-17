import {
  defineConfig,
  devices,
  type ReporterDescription,
} from "@playwright/test";

const baseURL = "http://localhost:3000";

/**
 * Set by `npm run test:e2e:coverage`. An env var rather than a `--coverage`
 * flag because Playwright's CLI rejects unknown options before loading this
 * config; worker processes inherit it, so `e2e/coverage.ts` reads it too.
 */
const collectCoverage = process.env.E2E_COVERAGE === "true";

const monocartReporter: ReporterDescription = [
  "monocart-reporter",
  {
    name: "Repo Lore Playwright Coverage Report",
    outputFile: "./coverage/e2e/report.html",
    coverage: {
      outputDir: "./coverage/e2e",
      entryFilter: (entry: { url: string; source?: string }) => {
        const { url, source } = entry;
        const returnValue =
          url.includes("/_next/static/") &&
          !url.includes("[turbopack]") &&
          !url.includes("%5Bturbopack%5D") &&
          !url.includes("node_modules") &&
          // Turbopack dev-mode chunks with no `sourceMappingURL` are
          // tiny internal loader/registration stubs (a few hundred
          // bytes) that can never resolve to a `src/` file — collecting
          // them just adds noise (`localhost-3000/_next/static/chunks/
          // _<hash>._.js`) to the report instead of a real source path.
          !!source?.includes("sourceMappingURL");
        return returnValue;
      },
      sourceFilter: (sourcePath: string) => {
        if (
          sourcePath.includes("node_modules") ||
          sourcePath.includes("[turbopack]") ||
          sourcePath.startsWith("next/") ||
          sourcePath.startsWith("_next/")
        ) {
          return false;
        }
        return sourcePath.startsWith("src/");
      },
      lcov: true,
    },
  },
];

/**
 * Functional/UI test suite, scoped to
 * pages that need no external services: the home page's client-side URL
 * validation. `reuseExistingServer` (local only) reuses a `next dev` a
 * developer already has running rather than failing to start a second one —
 * Next.js refuses to run two dev servers against the same directory.
 *
 * `screenshot: "only-on-failure"` attaches a screenshot to each failing test,
 * viewable in the `html` reporter's own report (`npx playwright show-report`).
 * The `monocart-reporter` entry (only when `collectCoverage`) collects V8
 * coverage (see `e2e/coverage.ts`) into `coverage/e2e/` — it doesn't replace
 * the `html` reporter above.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ...(collectCoverage ? [monocartReporter] : []),
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    browserName: "chromium",
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
