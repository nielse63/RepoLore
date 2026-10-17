/**
 * Pure comparison logic for the Lighthouse performance regression check
 * (`scripts/perf-vitals.ts`, `npm run test:perf`): takes per-run lab metrics
 * for a target instance and for production, reduces each to a median, and
 * flags a metric as regressed only when the target is worse than production
 * by more than BOTH its relative and absolute tolerance — so tiny metrics
 * (a 20ms TBT doubling to 40ms) and noise on large ones don't fail CI.
 */

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
  /** Reported but never fails the check when false. */
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
          ? "❌ regressed"
          : "✅";
      lines.push(
        `| ${tolerance.label} | ${formatMetricValue(m.id, m.target)} | ${formatMetricValue(m.id, m.production)} | ${sign}${formatMetricValue(m.id, Math.abs(m.delta))} | ${result} |`
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
