import { isCrawlerUserAgent } from "@/lib/is-crawler-user-agent";
import {
  breachesOf,
  coldLoadViolations,
  compareMetric,
  compareSamples,
  formatMarkdownReport,
  formatPrComment,
  isNotAnalyzedLoreHtml,
  median,
  METRIC_IDS,
  newIssueUrl,
  perfUserAgent,
  PR_COMMENT_MARKER,
  type LighthouseResult,
  type MetricSample,
  type PageComparison,
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
      "| LCP | 4000 ms | 2000 ms | +2000 ms | ⚠️ over tolerance |"
    );
    expect(report).toContain("| CLS | 0.000 | 0.000 | 0.000 | ✅ |");
    expect(report).toContain("| TTFB | 100 ms | 100 ms | 0 ms | info |");
  });
});

describe("perfUserAgent", () => {
  // Lighthouse 13's own emulated user agents (lighthouse/core/config/constants.js).
  const lighthouseUserAgents = [
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  ];

  it.each(lighthouseUserAgents)(
    "makes a person-looking Lighthouse user agent read as a crawler: %s",
    (userAgent) => {
      expect(isCrawlerUserAgent(userAgent)).toBe(false);
      expect(isCrawlerUserAgent(perfUserAgent(userAgent))).toBe(true);
    }
  );
});

describe("isNotAnalyzedLoreHtml", () => {
  it("detects NotAnalyzedPanel's rendered heading", () => {
    expect(
      isNotAnalyzedLoreHtml(
        "<h1><span>sindresorhus/globby</span> hasn&#x27;t been analyzed yet</h1>"
      )
    ).toBe(true);
  });

  it("does not flag a real Lore page", () => {
    expect(isNotAnalyzedLoreHtml("<h1>sindresorhus/globby</h1>")).toBe(false);
  });
});

describe("coldLoadViolations", () => {
  const url = "https://repolore.app/explore";

  function lhr(overrides: Partial<LighthouseResult> = {}): LighthouseResult {
    return {
      requestedUrl: url,
      mainDocumentUrl: url,
      finalDisplayedUrl: url,
      configSettings: { disableStorageReset: false },
      audits: {
        "network-requests": {
          details: {
            items: [
              { url, statusCode: 200 },
              {
                url: "https://repolore.app/_next/static/chunks/main.js",
                statusCode: 200,
              },
            ],
          },
        },
      },
      ...overrides,
    };
  }

  it("accepts a cold, direct load", () => {
    expect(coldLoadViolations(lhr())).toEqual([]);
  });

  it("flags a redirect folded into the navigation", () => {
    expect(
      coldLoadViolations(lhr({ requestedUrl: "http://repolore.app/explore" }))
    ).toContain(`redirected to ${url}`);
  });

  it("flags a client-side navigation away from the measured page", () => {
    expect(
      coldLoadViolations(lhr({ finalDisplayedUrl: "https://repolore.app/" }))
    ).toContain("navigated client-side to https://repolore.app/");
  });

  it("flags a disabled storage reset", () => {
    expect(
      coldLoadViolations(lhr({ configSettings: { disableStorageReset: true } }))
    ).toContain("Lighthouse's storage reset was not enabled");
  });

  it("flags a non-200 main document", () => {
    const result = lhr();
    result.audits["network-requests"]!.details!.items![0].statusCode = 304;
    expect(coldLoadViolations(result)).toContain("main document responded 304");
  });
});

describe("PR comment", () => {
  const breaching: PageComparison = {
    path: "/explore",
    profile: "mobile",
    metrics: compareSamples(
      [sample({ "largest-contentful-paint": 4000 })],
      [sample()]
    ),
  };
  const clean: PageComparison = {
    path: "/",
    profile: "desktop",
    metrics: compareSamples([sample()], [sample()]),
  };
  const context = {
    productionUrl: "https://repolore.app",
    runs: 3,
    serverUrl: "https://github.com",
    repository: "nielse63/RepoLore",
    runUrl: "https://github.com/nielse63/RepoLore/actions/runs/42",
    prNumber: "36",
    commitSha: "abcdef1234567890",
  };

  it("lists only metrics over tolerance as breaches", () => {
    expect(breachesOf([breaching, clean])).toEqual([
      {
        path: "/explore",
        profile: "mobile",
        id: "largest-contentful-paint",
        target: 4000,
        production: 2000,
        delta: 2000,
      },
    ]);
  });

  it("reports breaches as non-blocking with a link to open a ticket", () => {
    const body = formatPrComment([breaching, clean], context, "FULL REPORT");
    expect(body.startsWith(PR_COMMENT_MARKER)).toBe(true);
    expect(body).toContain("1 metric(s) over tolerance");
    expect(body).toContain("This doesn't block merging.");
    expect(body).toContain(
      "| `/explore` | mobile | LCP | 4000 ms | 2000 ms | +2000 ms |"
    );
    expect(body).toContain(
      "[creating a ticket](https://github.com/nielse63/RepoLore/issues/new?"
    );
    expect(body).toContain("as of abcdef1");
    expect(body).toContain("FULL REPORT");
  });

  it("renders an all-clear without breaches", () => {
    const body = formatPrComment([clean], context, "FULL REPORT");
    expect(body.startsWith(PR_COMMENT_MARKER)).toBe(true);
    expect(body).toContain("No metrics over tolerance");
    expect(body).not.toContain("FULL REPORT");
  });

  it("pre-fills the new issue with the breaches and the run", () => {
    const url = new URL(newIssueUrl(breachesOf([breaching]), context)!);
    expect(url.pathname).toBe("/nielse63/RepoLore/issues/new");
    expect(url.searchParams.get("title")).toBe(
      "Performance: 1 metric(s) over tolerance vs. production (PR #36)"
    );
    const body = url.searchParams.get("body");
    expect(body).toContain("| `/explore` | mobile | LCP |");
    expect(body).toContain(
      "Workflow run: https://github.com/nielse63/RepoLore/actions/runs/42"
    );
  });

  it("has no ticket link outside GitHub Actions", () => {
    const local = { productionUrl: "https://repolore.app", runs: 3 };
    expect(newIssueUrl(breachesOf([breaching]), local)).toBeUndefined();
    expect(formatPrComment([breaching], local, "")).toContain(
      "consider creating a ticket"
    );
  });
});
