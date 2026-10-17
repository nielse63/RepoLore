/**
 * Performance regression check for the static pages: runs Lighthouse
 * (performance category only, mobile and desktop presets) against a target
 * instance and against production, alternating target/production on each
 * run so drift in the machine's load hits both equally, then compares the
 * medians via `src/perf/compare-vitals.ts`. Exits non-zero if any gated
 * metric regressed past its tolerance, or if any Lighthouse run errored.
 *
 * Usage: npm run test:perf
 *   PERF_TARGET_URL      instance under test (default http://localhost:3000,
 *                        expected to be a `npm run build && npm run start`)
 *   PERF_PRODUCTION_URL  baseline (default https://repolore.app)
 *   PERF_RUNS            runs per page/profile/instance (default 3)
 *   CHROME_PATH          Chrome binary, if Lighthouse can't find one
 *
 * Writes perf-report/report.json and perf-report/report.md.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  compareSamples,
  formatMarkdownReport,
  METRIC_IDS,
  type MetricSample,
  type PageComparison,
} from "../src/perf/compare-vitals";

const PAGES = ["/", "/explore", "/manifesto"];

/** No preset is Lighthouse's default: mobile with simulated throttling. */
const PROFILES: { name: string; flags: string[] }[] = [
  { name: "mobile", flags: [] },
  { name: "desktop", flags: ["--preset=desktop"] },
];

const targetUrl = process.env.PERF_TARGET_URL ?? "http://localhost:3000";
const productionUrl = process.env.PERF_PRODUCTION_URL ?? "https://repolore.app";
const runs = Number(process.env.PERF_RUNS ?? 3);
const outDir = path.join(process.cwd(), "perf-report");

const chromeFlags = [
  "--headless=new",
  // GitHub-hosted Ubuntu runners can't use Chrome's sandbox.
  ...(process.env.CI ? ["--no-sandbox"] : []),
].join(" ");

interface LighthouseResult {
  runtimeError?: { code: string; message: string };
  audits: Record<string, { numericValue?: number } | undefined>;
}

/**
 * Runs the Lighthouse CLI rather than its Node API: under `tsx`, esbuild's
 * `__name` helpers leak into the functions Lighthouse serializes into the
 * page, which then fail in the browser. Each run launches a fresh Chrome,
 * so no cache or connection state carries over.
 */
async function measure(url: string, profileFlags: string[]) {
  const { stdout } = await promisify(execFile)(
    path.join(process.cwd(), "node_modules/.bin/lighthouse"),
    [
      url,
      "--output=json",
      "--output-path=stdout",
      "--only-categories=performance",
      "--quiet",
      `--chrome-flags=${chromeFlags}`,
      ...profileFlags,
    ],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const lhr = JSON.parse(stdout) as LighthouseResult;
  if (lhr.runtimeError) {
    throw new Error(
      `Lighthouse failed on ${url}: ${lhr.runtimeError.code} ${lhr.runtimeError.message}`
    );
  }
  const sample = {} as MetricSample;
  for (const id of METRIC_IDS) {
    const value = lhr.audits[id]?.numericValue;
    if (typeof value !== "number") {
      throw new Error(`Lighthouse reported no ${id} for ${url}`);
    }
    sample[id] = value;
  }
  return sample;
}

/** One untimed request per URL so a just-started server isn't measured cold. */
async function warmUp(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}; is it running?`);
  }
  await response.arrayBuffer();
}

async function main() {
  const urls = PAGES.flatMap((page) => [
    new URL(page, targetUrl).href,
    new URL(page, productionUrl).href,
  ]);
  await Promise.all(urls.map(warmUp));

  const pages: PageComparison[] = [];
  // Every run's raw values, so noise in a median can be inspected afterwards.
  const samples: {
    path: string;
    profile: string;
    target: MetricSample[];
    production: MetricSample[];
  }[] = [];
  for (const page of PAGES) {
    for (const profile of PROFILES) {
      const targetRuns: MetricSample[] = [];
      const productionRuns: MetricSample[] = [];
      for (let i = 1; i <= runs; i++) {
        console.log(`${page} (${profile.name}) run ${i}/${runs}`);
        targetRuns.push(
          await measure(new URL(page, targetUrl).href, profile.flags)
        );
        productionRuns.push(
          await measure(new URL(page, productionUrl).href, profile.flags)
        );
      }
      samples.push({
        path: page,
        profile: profile.name,
        target: targetRuns,
        production: productionRuns,
      });
      pages.push({
        path: page,
        profile: profile.name,
        metrics: compareSamples(targetRuns, productionRuns),
      });
    }
  }

  const markdown = formatMarkdownReport(targetUrl, productionUrl, pages);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify({ targetUrl, productionUrl, runs, pages, samples }, null, 2)
  );
  await fs.writeFile(path.join(outDir, "report.md"), markdown);
  console.log(`\n${markdown}`);

  const regressions = pages.flatMap((page) =>
    page.metrics
      .filter((m) => m.regressed)
      .map((m) => `${page.path} (${page.profile}): ${m.id}`)
  );
  if (regressions.length > 0) {
    console.error(`✗ ${regressions.length} regression(s):`);
    for (const regression of regressions) console.error(`  ${regression}`);
    process.exit(1);
  }
  console.log("✓ No performance regressions against production.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
