/**
 * Performance budget check for key pages: runs Lighthouse
 * (performance category only, mobile and desktop presets) against a target
 * instance and against production, alternating target/production on each
 * run so drift in the machine's load hits both equally, then compares the
 * target's medians to each profile's budget via `src/perf/compare-vitals.ts`
 * (production is measured for context only). Every page is a cold, direct
 * load: a fresh Chrome profile per run, Lighthouse's storage reset, and no
 * redirect — any run that wasn't fails the check, as does any Lighthouse or
 * setup error. Metrics over budget do NOT fail it: they're reported (and,
 * in CI, commented on the PR) as advisory breaches.
 *
 * Usage: npm run test:perf (builds and starts a production server on port
 * 3100 via `.bin/with-prod-server`, and stops it when this script exits)
 *   PERF_TARGET_URL      instance under test (default http://localhost:3100)
 *   PERF_PRODUCTION_URL  baseline (default https://repolore.app)
 *   PERF_RUNS            runs per page/profile/instance (default 3)
 *   CHROME_PATH          Chrome binary, if Lighthouse can't find one
 *
 * Writes perf-report/report.json, report.md (the full tables), and
 * pr-comment.md (the PR comment body). In GitHub Actions, PERF_PR_NUMBER and
 * PERF_COMMIT_SHA (the PR head, not the merge commit) feed the comment.
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { userAgents } from "lighthouse/core/config/constants.js";
import {
  breachesOf,
  coldLoadViolations,
  compareSamples,
  formatMarkdownReport,
  formatPrComment,
  isNotAnalyzedLoreHtml,
  METRIC_IDS,
  perfUserAgent,
  METRICS,
  type Profile,
  type LighthouseResult,
  type MetricSample,
  type PageComparison,
} from "../src/perf/compare-vitals";

/**
 * The static pages plus one real Lore Overview. That Lore must already be
 * analyzed on both production and the target's database, or the comparison
 * measures the "not analyzed" panel instead.
 */
const PAGES = ["/", "/explore", "/manifesto", "/lore/sindresorhus/globby"];

/**
 * No preset is Lighthouse's default: mobile with simulated throttling. Each
 * keeps its preset's own device user agent, plus the perf-bot token.
 */
const PROFILES: { name: Profile; flags: string[] }[] = [
  {
    name: "mobile",
    flags: [`--emulatedUserAgent=${perfUserAgent(userAgents.mobile)}`],
  },
  {
    name: "desktop",
    flags: [
      "--preset=desktop",
      `--emulatedUserAgent=${perfUserAgent(userAgents.desktop)}`,
    ],
  },
];

const targetUrl = process.env.PERF_TARGET_URL ?? "http://localhost:3100";
const productionUrl = process.env.PERF_PRODUCTION_URL ?? "https://repolore.app";
const runs = Number(process.env.PERF_RUNS ?? 3);
const outDir = path.join(process.cwd(), "perf-report");

const chromeFlags = [
  "--headless=new",
  // GitHub-hosted Ubuntu runners can't use Chrome's sandbox.
  ...(process.env.CI ? ["--no-sandbox"] : []),
].join(" ");

/**
 * Runs the Lighthouse CLI rather than its Node API: under `tsx`, esbuild's
 * `__name` helpers leak into the functions Lighthouse serializes into the
 * page, which then fail in the browser. Each run launches a fresh Chrome
 * (a new temporary profile), so no cache or connection state carries over;
 * `coldLoadViolations` then confirms the run really was cold and direct.
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
  const violations = coldLoadViolations(lhr);
  if (violations.length > 0) {
    throw new Error(
      `${url} was not a cold, direct load: ${violations.join("; ")}`
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

/**
 * One untimed request per URL so a just-started server's first-request cost
 * isn't measured — production is always warm, so skipping this would bias
 * against the target. "Cold" here means the browser, not the server. It also
 * checks every URL responds directly (no redirect) and every Lore route is
 * really analyzed on both sides.
 */
async function warmUp(url: string) {
  // Same perf-bot token as Lighthouse: Node's default user agent reads as a
  // person, so this request alone would pull-trigger a stale Lore's refresh.
  const response = await fetch(url, {
    headers: { "user-agent": perfUserAgent(userAgents.desktop) },
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `${url} redirects (${response.status}) to ${response.headers.get("location")}; measure the final URL directly.`
    );
  }
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}; is it running?`);
  }
  const html = await response.text();
  if (isNotAnalyzedLoreHtml(html)) {
    throw new Error(
      `${url} rendered the "not analyzed" panel; analyze that repository on this instance's database first.`
    );
  }
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
    profile: Profile;
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
        metrics: compareSamples(profile.name, targetRuns, productionRuns),
      });
    }
  }

  const markdown = formatMarkdownReport(targetUrl, productionUrl, pages);
  const breaches = breachesOf(pages);
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
  const prComment = formatPrComment(
    pages,
    {
      productionUrl,
      runs,
      serverUrl: GITHUB_SERVER_URL,
      repository: GITHUB_REPOSITORY,
      runUrl:
        GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
          ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
          : undefined,
      prNumber: process.env.PERF_PR_NUMBER,
      commitSha: process.env.PERF_COMMIT_SHA,
    },
    markdown
  );
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, "report.json"),
    JSON.stringify(
      { targetUrl, productionUrl, runs, breaches, pages, samples },
      null,
      2
    )
  );
  await fs.writeFile(path.join(outDir, "report.md"), markdown);
  await fs.writeFile(path.join(outDir, "pr-comment.md"), prComment);
  console.log(`\n${markdown}`);

  if (breaches.length === 0) {
    console.log("✓ No metrics over budget.");
    return;
  }
  // Advisory only: reported, never a non-zero exit.
  console.warn(`⚠ ${breaches.length} metric(s) over budget (non-blocking):`);
  for (const b of breaches) {
    const line = `${b.path} (${b.profile}): ${METRICS[b.id].label}`;
    console.warn(`  ${line}`);
    // Surfaces each breach as an annotation on the workflow run.
    if (process.env.GITHUB_ACTIONS) {
      console.log(`::warning title=Performance over budget::${line}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
