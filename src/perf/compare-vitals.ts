/**
 * Pure logic for the Lighthouse performance budget check
 * (`scripts/perf-vitals.ts`, `npm run test:perf`): takes per-run lab metrics
 * for a target instance and for production, reduces each to a median, and
 * flags a metric as over budget when the target's median exceeds that
 * profile's budget (`BUDGETS`). Production is measured alongside purely as
 * context — it never decides a breach. Breaches are advisory: they're
 * reported on the PR, never fail CI.
 */

/**
 * Appended to Lighthouse's emulated user agent so `isCrawlerUserAgent`
 * (`bot\b`) classifies perf runs as crawlers: a Lore page view by a person
 * pull-triggers a background re-analysis of a stale repository (ADR-0013,
 * ADR-0017), which a perf run — on production or the instance under test —
 * must never do.
 */
export const PERF_USER_AGENT_TOKEN = "RepoLorePerfBot";

export function perfUserAgent(baseUserAgent: string): string {
  return `${baseUserAgent} ${PERF_USER_AGENT_TOKEN}`;
}

/**
 * Whether a measured page is `NotAnalyzedPanel` ("{owner}/{repo} hasn't
 * been analyzed yet") rather than a real Lore. It still responds 200, so
 * without this a Lore route missing from one side's database would silently
 * compare a different page against production's.
 */
export function isNotAnalyzedLoreHtml(html: string): boolean {
  return html.includes("been analyzed yet");
}

/** The subset of a Lighthouse result (LHR) this check reads. */
export interface LighthouseResult {
  requestedUrl?: string;
  mainDocumentUrl?: string;
  finalDisplayedUrl?: string;
  runtimeError?: { code: string; message: string };
  configSettings?: { disableStorageReset?: boolean };
  audits: Record<
    string,
    | {
        numericValue?: number;
        details?: { items?: NetworkRequestItem[] };
      }
    | undefined
  >;
}

interface NetworkRequestItem {
  url: string;
  statusCode?: number;
}

/**
 * Why a Lighthouse run wasn't a cold, direct load of the URL it was given —
 * empty when it was. Cold is guaranteed by construction: the Lighthouse CLI
 * launches Chrome via chrome-launcher, which gives every launch a brand-new
 * `mktemp -d` profile (empty disk cache) and deletes it afterwards. So this
 * doesn't inspect per-request cache hits — a "disk" or "memory" hit can only
 * be the page reusing a resource it fetched earlier in the same load. It
 * checks what could still go wrong: Lighthouse's storage reset being off,
 * and a redirect (`http`→`https`, `www`, trailing slash) or client-side
 * navigation folded into the measured load.
 */
export function coldLoadViolations(lhr: LighthouseResult): string[] {
  const violations: string[] = [];
  const { requestedUrl, mainDocumentUrl, finalDisplayedUrl } = lhr;
  if (lhr.configSettings?.disableStorageReset !== false) {
    violations.push("Lighthouse's storage reset was not enabled");
  }
  if (!requestedUrl || !mainDocumentUrl) {
    violations.push("Lighthouse reported no requested/main document URL");
    return violations;
  }
  if (mainDocumentUrl !== requestedUrl) {
    violations.push(`redirected to ${mainDocumentUrl}`);
  }
  if (finalDisplayedUrl && finalDisplayedUrl !== mainDocumentUrl) {
    violations.push(`navigated client-side to ${finalDisplayedUrl}`);
  }
  const requests = lhr.audits["network-requests"]?.details?.items ?? [];
  const document = requests.find((r) => r.url === mainDocumentUrl);
  if (!document) {
    violations.push("main document missing from network requests");
  } else if (document.statusCode !== 200) {
    violations.push(`main document responded ${document.statusCode}`);
  }
  return violations;
}

export const METRIC_IDS = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
  "speed-index",
  "server-response-time",
] as const;

export type MetricId = (typeof METRIC_IDS)[number];

export type MetricSample = Record<MetricId, number>;

export type Profile = "mobile" | "desktop";

export interface MetricInfo {
  label: string;
  unit: "ms" | "unitless";
  /** Shown against its budget, but never counted as a breach, when false. */
  gate: boolean;
}

export const METRICS: Record<MetricId, MetricInfo> = {
  "first-contentful-paint": { label: "FCP", unit: "ms", gate: true },
  "largest-contentful-paint": { label: "LCP", unit: "ms", gate: true },
  "cumulative-layout-shift": { label: "CLS", unit: "unitless", gate: true },
  "total-blocking-time": { label: "TBT", unit: "ms", gate: true },
  "speed-index": { label: "Speed Index", unit: "ms", gate: true },
  // Report-only: a CI-local server's TTFB reflects the runner's distance to
  // the database and the lack of a network hop, not the PR's code.
  "server-response-time": { label: "TTFB", unit: "ms", gate: false },
};

/**
 * The most a page's median may reach, per profile (ms; CLS unitless).
 * Desktop is the product owner's own budget. Mobile — simulated slow 4G and
 * a 4x CPU slowdown, where e.g. a 0.5s FCP is unreachable even for
 * production — uses Google's "good" Core Web Vitals / Lighthouse thresholds.
 */
export const BUDGETS: Record<Profile, Record<MetricId, number>> = {
  desktop: {
    "largest-contentful-paint": 1500,
    "first-contentful-paint": 500,
    "cumulative-layout-shift": 0.1,
    "total-blocking-time": 150,
    "speed-index": 1500,
    "server-response-time": 500,
  },
  mobile: {
    "largest-contentful-paint": 2500,
    "first-contentful-paint": 1800,
    "cumulative-layout-shift": 0.1,
    "total-blocking-time": 200,
    "speed-index": 3400,
    "server-response-time": 800,
  },
};

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export interface MetricComparison {
  id: MetricId;
  budget: number;
  target: number;
  production: number;
  /** The target's median exceeds the budget (gated metrics only). */
  overBudget: boolean;
  /** Context only: production's median also exceeds the budget. */
  productionOverBudget: boolean;
}

export function compareMetric(
  id: MetricId,
  profile: Profile,
  target: number,
  production: number
): MetricComparison {
  const budget = BUDGETS[profile][id];
  return {
    id,
    budget,
    target,
    production,
    overBudget: METRICS[id].gate && target > budget,
    productionOverBudget: production > budget,
  };
}

export function compareSamples(
  profile: Profile,
  targetRuns: MetricSample[],
  productionRuns: MetricSample[]
): MetricComparison[] {
  return METRIC_IDS.map((id) =>
    compareMetric(
      id,
      profile,
      median(targetRuns.map((run) => run[id])),
      median(productionRuns.map((run) => run[id]))
    )
  );
}

export function formatMetricValue(id: MetricId, value: number): string {
  return METRICS[id].unit === "ms"
    ? `${Math.round(value)} ms`
    : value.toFixed(3);
}

export interface PageComparison {
  path: string;
  profile: Profile;
  metrics: MetricComparison[];
}

/** A GitHub-flavored Markdown table per page/profile, for the job summary. */
export function formatMarkdownReport(
  targetUrl: string,
  productionUrl: string,
  pages: PageComparison[]
): string {
  const lines = [
    "## Performance budget check",
    "",
    `Target \`${targetUrl}\` against each profile's budget (median of each run set), with production \`${productionUrl}\` for context.`,
    "",
  ];
  for (const page of pages) {
    lines.push(
      `### \`${page.path}\` (${page.profile})`,
      "",
      "| Metric | Budget | Target | Production | Result |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const m of page.metrics) {
      const info = METRICS[m.id];
      const result = !info.gate
        ? "info"
        : m.overBudget
          ? "⚠️ over budget"
          : "✅";
      lines.push(
        `| ${info.label} | ${formatMetricValue(m.id, m.budget)} | ${formatMetricValue(m.id, m.target)} | ${formatMetricValue(m.id, m.production)} | ${result} |`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface Breach {
  path: string;
  profile: Profile;
  id: MetricId;
  budget: number;
  target: number;
  production: number;
  productionOverBudget: boolean;
}

export function breachesOf(pages: PageComparison[]): Breach[] {
  return pages.flatMap((page) =>
    page.metrics
      .filter((m) => m.overBudget)
      .map(({ id, budget, target, production, productionOverBudget }) => ({
        path: page.path,
        profile: page.profile,
        id,
        budget,
        target,
        production,
        productionOverBudget,
      }))
  );
}

/** Lets the workflow find and update its own comment instead of adding more. */
export const PR_COMMENT_MARKER = "<!-- repolore-perf-check -->";

export interface PrCommentContext {
  productionUrl: string;
  runs: number;
  /** e.g. https://github.com */
  serverUrl?: string;
  /** owner/repo */
  repository?: string;
  runUrl?: string;
  prNumber?: string;
  commitSha?: string;
}

/**
 * Whether production is over the same budget tells a reader if the breach
 * predates this PR, so the row says so rather than leaving it to inference.
 */
function breachRow(b: Breach): string {
  const production = `${formatMetricValue(b.id, b.production)}${b.productionOverBudget ? " (also over)" : ""}`;
  return `| \`${b.path}\` | ${b.profile} | ${METRICS[b.id].label} | ${formatMetricValue(b.id, b.budget)} | ${formatMetricValue(b.id, b.target)} | ${production} |`;
}

const BREACH_TABLE_HEADER = [
  "| Page | Profile | Metric | Budget | This PR | Production |",
  "| --- | --- | --- | --- | --- | --- |",
];

/** A pre-filled "new issue" URL, or undefined outside GitHub Actions. */
export function newIssueUrl(
  breaches: Breach[],
  context: PrCommentContext
): string | undefined {
  if (!context.serverUrl || !context.repository) return undefined;
  const pr = context.prNumber ? ` (PR #${context.prNumber})` : "";
  const title = `Performance: ${breaches.length} metric(s) over budget${pr}`;
  const body = [
    `\`npm run test:perf\` found these medians over budget${context.commitSha ? ` at ${context.commitSha.slice(0, 7)}` : ""} (production: ${context.productionUrl}):`,
    "",
    ...BREACH_TABLE_HEADER,
    ...breaches.map(breachRow),
    "",
    ...(context.runUrl ? [`Workflow run: ${context.runUrl}`] : []),
  ].join("\n");
  const query = new URLSearchParams({ title, body });
  return `${context.serverUrl}/${context.repository}/issues/new?${query}`;
}

/**
 * The PR comment body. With breaches: a table of them and a suggestion to
 * open a ticket (non-blocking). Without: a short all-clear, which the
 * workflow only posts to update an earlier breach comment.
 */
export function formatPrComment(
  pages: PageComparison[],
  context: PrCommentContext,
  fullReport: string
): string {
  const breaches = breachesOf(pages);
  const commit = context.commitSha
    ? ` as of ${context.commitSha.slice(0, 7)}`
    : "";
  const run = context.runUrl ? ` ([workflow run](${context.runUrl}))` : "";
  if (breaches.length === 0) {
    return [
      PR_COMMENT_MARKER,
      "## ✅ Performance check",
      "",
      `No metrics over budget${commit}${run}.`,
      "",
    ].join("\n");
  }
  const issueUrl = newIssueUrl(breaches, context);
  return [
    PR_COMMENT_MARKER,
    `## ⚠️ Performance check: ${breaches.length} metric(s) over budget`,
    "",
    `Medians of ${context.runs} Lighthouse run(s) per page and profile that exceed that profile's budget${commit}${run}; "also over" means production (${context.productionUrl}) exceeds it too, so the breach predates this PR. **This doesn't block merging.**`,
    "",
    ...BREACH_TABLE_HEADER,
    ...breaches.map(breachRow),
    "",
    `If re-running the job reproduces this (lab metrics are noisy), consider ${issueUrl ? `[creating a ticket](${issueUrl})` : "creating a ticket"} to investigate it rather than holding this PR.`,
    "",
    "<details><summary>Full results</summary>",
    "",
    fullReport,
    "",
    "</details>",
    "",
  ].join("\n");
}
