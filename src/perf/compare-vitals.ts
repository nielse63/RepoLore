/**
 * Pure logic for the Lighthouse performance regression check
 * (`scripts/perf-vitals.ts`, `npm run test:perf`): takes per-run lab metrics
 * for a target instance and for production, reduces each to a median, and
 * flags a metric as over tolerance only when the target is worse than
 * production by more than BOTH its relative and absolute tolerance — so tiny
 * metrics (a 20ms TBT doubling to 40ms) and noise on large ones aren't
 * reported. Breaches are advisory: they're reported on the PR, never fail CI.
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

export interface MetricTolerance {
  label: string;
  unit: "ms" | "unitless";
  /** Allowed fractional increase over production, e.g. 0.2 for +20%. */
  relative: number;
  /** Allowed absolute increase over production, in the metric's unit. */
  absolute: number;
  /** Reported, but never counted as over tolerance, when false. */
  gate: boolean;
}

export const TOLERANCES: Record<MetricId, MetricTolerance> = {
  "first-contentful-paint": {
    label: "FCP",
    unit: "ms",
    relative: 0.2,
    absolute: 200,
    gate: true,
  },
  "largest-contentful-paint": {
    label: "LCP",
    unit: "ms",
    relative: 0.2,
    absolute: 250,
    gate: true,
  },
  // Relative change is meaningless near zero, so CLS gates on absolute only.
  "cumulative-layout-shift": {
    label: "CLS",
    unit: "unitless",
    relative: 0,
    absolute: 0.05,
    gate: true,
  },
  "total-blocking-time": {
    label: "TBT",
    unit: "ms",
    relative: 0.5,
    absolute: 100,
    gate: true,
  },
  "speed-index": {
    label: "Speed Index",
    unit: "ms",
    relative: 0.2,
    absolute: 300,
    gate: true,
  },
  // Informational only: a CI-local server's TTFB reflects the runner's
  // distance to the database and the lack of a network hop, not the code.
  "server-response-time": {
    label: "TTFB",
    unit: "ms",
    relative: 0.5,
    absolute: 200,
    gate: false,
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
  target: number;
  production: number;
  delta: number;
  regressed: boolean;
}

export function compareMetric(
  id: MetricId,
  target: number,
  production: number,
  tolerance: MetricTolerance = TOLERANCES[id]
): MetricComparison {
  const delta = target - production;
  const relativeDelta =
    production === 0 ? (delta > 0 ? Infinity : 0) : delta / production;
  const regressed =
    tolerance.gate &&
    delta > tolerance.absolute &&
    relativeDelta > tolerance.relative;
  return { id, target, production, delta, regressed };
}

export function compareSamples(
  targetRuns: MetricSample[],
  productionRuns: MetricSample[]
): MetricComparison[] {
  return METRIC_IDS.map((id) =>
    compareMetric(
      id,
      median(targetRuns.map((run) => run[id])),
      median(productionRuns.map((run) => run[id]))
    )
  );
}

export function formatMetricValue(id: MetricId, value: number): string {
  return TOLERANCES[id].unit === "ms"
    ? `${Math.round(value)} ms`
    : value.toFixed(3);
}

export interface PageComparison {
  path: string;
  profile: string;
  metrics: MetricComparison[];
}

/** A GitHub-flavored Markdown table per page/profile, for the job summary. */
export function formatMarkdownReport(
  targetUrl: string,
  productionUrl: string,
  pages: PageComparison[]
): string {
  const lines = [
    "## Performance regression check",
    "",
    `Target \`${targetUrl}\` vs. production \`${productionUrl}\` (median of each run set).`,
    "",
  ];
  for (const page of pages) {
    lines.push(
      `### \`${page.path}\` (${page.profile})`,
      "",
      "| Metric | Target | Production | Δ | Result |",
      "| --- | --- | --- | --- | --- |"
    );
    for (const m of page.metrics) {
      const tolerance = TOLERANCES[m.id];
      const sign = m.delta > 0 ? "+" : m.delta < 0 ? "−" : "";
      const result = !tolerance.gate
        ? "info"
        : m.regressed
          ? "⚠️ over tolerance"
          : "✅";
      lines.push(
        `| ${tolerance.label} | ${formatMetricValue(m.id, m.target)} | ${formatMetricValue(m.id, m.production)} | ${sign}${formatMetricValue(m.id, Math.abs(m.delta))} | ${result} |`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

export interface Breach {
  path: string;
  profile: string;
  id: MetricId;
  target: number;
  production: number;
  delta: number;
}

export function breachesOf(pages: PageComparison[]): Breach[] {
  return pages.flatMap((page) =>
    page.metrics
      .filter((m) => m.regressed)
      .map(({ id, target, production, delta }) => ({
        path: page.path,
        profile: page.profile,
        id,
        target,
        production,
        delta,
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

function breachRow(b: Breach): string {
  return `| \`${b.path}\` | ${b.profile} | ${TOLERANCES[b.id].label} | ${formatMetricValue(b.id, b.target)} | ${formatMetricValue(b.id, b.production)} | +${formatMetricValue(b.id, b.delta)} |`;
}

const BREACH_TABLE_HEADER = [
  "| Page | Profile | Metric | This PR | Production | Δ |",
  "| --- | --- | --- | --- | --- | --- |",
];

/** A pre-filled "new issue" URL, or undefined outside GitHub Actions. */
export function newIssueUrl(
  breaches: Breach[],
  context: PrCommentContext
): string | undefined {
  if (!context.serverUrl || !context.repository) return undefined;
  const pr = context.prNumber ? ` (PR #${context.prNumber})` : "";
  const title = `Performance: ${breaches.length} metric(s) over tolerance vs. production${pr}`;
  const body = [
    `\`npm run test:perf\` found these medians worse than ${context.productionUrl} beyond tolerance${context.commitSha ? ` at ${context.commitSha.slice(0, 7)}` : ""}:`,
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
      `No metrics over tolerance vs. ${context.productionUrl}${commit}${run}.`,
      "",
    ].join("\n");
  }
  const issueUrl = newIssueUrl(breaches, context);
  return [
    PR_COMMENT_MARKER,
    `## ⚠️ Performance check: ${breaches.length} metric(s) over tolerance`,
    "",
    `Medians of ${context.runs} Lighthouse run(s) per page and profile, worse than ${context.productionUrl} by more than both their relative and absolute tolerance${commit}${run}. **This doesn't block merging.**`,
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
