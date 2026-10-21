import {
  defineConfig,
  devices,
  type ReporterDescription,
} from "@playwright/test";

/** Matches `.bin/serve-prod`'s default port, clear of `next dev`'s 3000. */
const baseURL = "http://localhost:3100";

/**
 * Set by `npm run test:e2e:coverage`. An env var rather than a `--coverage`
 * flag because Playwright's CLI rejects unknown options before loading this
 * config; worker processes inherit it, so `e2e/coverage.ts` reads it too.
 */
const collectCoverage = process.env.E2E_COVERAGE === "true";

/**
 * Production Turbopack source maps name sources `[project]/src/...` (after
 * monocart drops the `turbopack:///` scheme); strip that so filtering and
 * the report work on plain `src/...` paths.
 */
const stripProjectPrefix = (sourcePath: string) =>
  sourcePath.replace(/^\[project\]\//, "");

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
          // Chunks with no `sourceMappingURL` can never resolve to a
          // `src/` file — collecting them just adds noise to the report
          // instead of a real source path. The production build only
          // emits browser source maps when `E2E_COVERAGE=true` (see
          // `next.config.ts`).
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
        return stripProjectPrefix(sourcePath).startsWith("src/");
      },
      sourcePath: stripProjectPrefix,
      lcov: true,
    },
  },
];

/**
 * Functional/UI test suite (including the accessibility and SEO specs),
 * run against a fresh production build of the current working tree:
 * `.bin/serve-prod` runs `next build` then `next start` on port 3100, so a
 * developer's `next dev` on 3000 is never reused or disturbed. Playwright
 * stops that server when the run ends — passing, failing, or interrupted.
 * `reuseExistingServer: false` makes a run fail rather than test whatever
 * else might already be on 3100.
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
    command: ".bin/serve-prod",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    // Covers `next build` as well as server startup.
    timeout: 600_000,
  },
});
