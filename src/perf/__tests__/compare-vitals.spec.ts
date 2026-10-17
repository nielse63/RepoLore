import {
  compareMetric,
  compareSamples,
  formatMarkdownReport,
  median,
  METRIC_IDS,
  type MetricSample,
} from "../compare-vitals";

function sample(overrides: Partial<MetricSample> = {}): MetricSample {
  return {
    "first-contentful-paint": 1000,
    "largest-contentful-paint": 2000,
    "cumulative-layout-shift": 0,
    "total-blocking-time": 50,
    "speed-index": 1500,
    "server-response-time": 100,
    ...overrides,
  };
}

describe("median", () => {
  it("returns the middle value of an odd-length list", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("averages the two middle values of an even-length list", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("throws on an empty list", () => {
    expect(() => median([])).toThrow();
  });
});

describe("compareMetric", () => {
  it("does not regress when only the relative tolerance is exceeded", () => {
    // +50% but only +100ms, under LCP's 250ms absolute tolerance.
    expect(compareMetric("largest-contentful-paint", 300, 200).regressed).toBe(
      false
    );
  });

  it("does not regress when only the absolute tolerance is exceeded", () => {
    // +300ms but only +10%, under LCP's 20% relative tolerance.
    expect(
      compareMetric("largest-contentful-paint", 3300, 3000).regressed
    ).toBe(false);
  });

  it("regresses when both tolerances are exceeded", () => {
    expect(compareMetric("largest-contentful-paint", 3000, 2000)).toMatchObject(
      { delta: 1000, regressed: true }
    );
  });

  it("never regresses when the target is faster", () => {
    expect(compareMetric("first-contentful-paint", 500, 2000).regressed).toBe(
      false
    );
  });

  it("gates CLS on absolute change even when production is zero", () => {
    expect(compareMetric("cumulative-layout-shift", 0.04, 0).regressed).toBe(
      false
    );
    expect(compareMetric("cumulative-layout-shift", 0.06, 0).regressed).toBe(
      true
    );
  });

  it("never regresses an ungated metric", () => {
    expect(compareMetric("server-response-time", 5000, 100).regressed).toBe(
      false
    );
  });
});

describe("compareSamples", () => {
  it("compares medians, so one outlier run does not regress", () => {
    const target = [
      sample(),
      sample({ "largest-contentful-paint": 9000 }),
      sample(),
    ];
    const result = compareSamples(target, [sample(), sample(), sample()]);
    expect(result.map((m) => m.id)).toEqual([...METRIC_IDS]);
    expect(result.every((m) => !m.regressed)).toBe(true);
  });

  it("flags a consistent regression", () => {
    const slow = sample({ "total-blocking-time": 400 });
    const result = compareSamples([slow, slow, slow], [sample(), sample()]);
    expect(result.find((m) => m.id === "total-blocking-time")?.regressed).toBe(
      true
    );
  });
});

describe("formatMarkdownReport", () => {
  it("renders a row per metric with its result", () => {
    const metrics = compareSamples(
      [sample({ "largest-contentful-paint": 4000 })],
      [sample()]
    );
    const report = formatMarkdownReport(
      "http://localhost:3000",
      "https://repolore.app",
      [{ path: "/", profile: "mobile", metrics }]
    );
    expect(report).toContain("### `/` (mobile)");
    expect(report).toContain(
      "| LCP | 4000 ms | 2000 ms | +2000 ms | ❌ regressed |"
    );
    expect(report).toContain("| CLS | 0.000 | 0.000 | 0.000 | ✅ |");
    expect(report).toContain("| TTFB | 100 ms | 100 ms | 0 ms | info |");
  });
});
