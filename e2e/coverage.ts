import { test as base, expect } from "@playwright/test";
import { addCoverageReport } from "monocart-reporter";

/**
 * Wraps `@playwright/test` with an automatic fixture that records Chromium V8
 * JS coverage for every test and feeds it into monocart-reporter's global
 * coverage report (`coverage/e2e/`, see `playwright.config.ts`). Import
 * `test`/`expect` from here instead of `@playwright/test` in e2e specs so
 * their coverage is included. A no-op unless `E2E_COVERAGE=true` (set by
 * `npm run test:e2e:coverage`), matching when that reporter is registered.
 *
 * The same fixture also aborts every Google Analytics request: the suite runs
 * against a production build, which loads `gtag.js` (`src/app/layout.tsx`),
 * and test page views must never reach the real GA property. The layout's
 * inline `gtag`/`dataLayer` shim still runs, so specs can assert on
 * `window.dataLayer`.
 */
const collectCoverage = process.env.E2E_COVERAGE === "true";

export const test = base.extend<{ autoTestFixture: string }>({
  autoTestFixture: [
    async ({ page }, use) => {
      await page.route(
        /^https:\/\/([a-z0-9-]+\.)*(googletagmanager|google-analytics)\.com\//,
        (route) => route.abort()
      );

      const shouldCollect =
        collectCoverage && test.info().project.name === "chromium";

      if (shouldCollect) {
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      }

      await use("autoTestFixture");

      if (shouldCollect) {
        const jsCoverage = await page.coverage.stopJSCoverage();
        await addCoverageReport(jsCoverage, test.info());
      }
    },
    { scope: "test", auto: true },
  ],
});

export { expect };
