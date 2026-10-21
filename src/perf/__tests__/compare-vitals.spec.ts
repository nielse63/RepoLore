import { isCrawlerUserAgent } from "@/lib/is-crawler-user-agent";
import {
  BUDGETS,
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

/** Every metric comfortably within both profiles' budgets. */
function sample(overrides: Partial<MetricSample> = {}): MetricSample {
  return {
    "first-contentful-paint": 300,
    "largest-contentful-paint": 1000,
    "cumulative-layout-shift": 0,
    "total-blocking-time": 50,
    "speed-index": 1000,
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

describe("BUDGETS", () => {
  it("uses the product owner's desktop budget", () => {
    expect(BUDGETS.desktop).toEqual({
      "largest-contentful-paint": 1500,
      "first-contentful-paint": 500,
      "cumulative-layout-shift": 0.1,
      "total-blocking-time": 150,
      "speed-index": 1500,
      "server-response-time": 500,
    });
  });

  it("uses Google's 'good' thresholds on mobile", () => {
    expect(BUDGETS.mobile).toEqual({
      "largest-contentful-paint": 2500,
      "first-contentful-paint": 1800,
      "cumulative-layout-shift": 0.1,
      "total-blocking-time": 200,
      "speed-index": 3400,
      "server-response-time": 800,
    });
  });
});

describe("compareMetric", () => {
  it("is over budget only when the target exceeds it", () => {
    expect(
      compareMetric("largest-contentful-paint", "desktop", 1500, 0).overBudget
    ).toBe(false);
    expect(
      compareMetric("largest-contentful-paint", "desktop", 1501, 0)
    ).toMatchObject({ budget: 1500, overBudget: true });
  });

  it("applies the profile's own budget", () => {
    // 2000ms LCP: over desktop's 1.5s, within mobile's 2.5s.
    expect(
      compareMetric("largest-contentful-paint", "desktop", 2000, 0).overBudget
    ).toBe(true);
    expect(
      compareMetric("largest-contentful-paint", "mobile", 2000, 0).overBudget
    ).toBe(false);
  });

  it("ignores production when deciding a breach", () => {
    // Faster than a slow production, but still over budget.
    expect(
      compareMetric("first-contentful-paint", "desktop", 600, 5000)
    ).toMatchObject({ overBudget: true, productionOverBudget: true });
    // Slower than a fast production, but within budget.
    expect(
      compareMetric("first-contentful-paint", "desktop", 450, 100)
    ).toMatchObject({ overBudget: false, productionOverBudget: false });
  });

  it("gates CLS as a unitless value", () => {
    expect(
      compareMetric("cumulative-layout-shift", "desktop", 0.1, 0).overBudget
    ).toBe(false);
    expect(
      compareMetric("cumulative-layout-shift", "desktop", 0.11, 0).overBudget
    ).toBe(true);
  });

  it("never counts TTFB as a breach, but still records production's", () => {
    expect(
      compareMetric("server-response-time", "desktop", 5000, 900)
    ).toMatchObject({ overBudget: false, productionOverBudget: true });
  });
});

describe("compareSamples", () => {
  it("compares medians, so one outlier run is not a breach", () => {
    const target = [
      sample(),
      sample({ "largest-contentful-paint": 9000 }),
      sample(),
    ];
    const result = compareSamples("desktop", target, [sample()]);
    expect(result.map((m) => m.id)).toEqual([...METRIC_IDS]);
    expect(result.every((m) => !m.overBudget)).toBe(true);
  });

  it("flags a consistent breach", () => {
    const slow = sample({ "total-blocking-time": 400 });
    const result = compareSamples("desktop", [slow, slow, slow], [sample()]);
    expect(result.find((m) => m.id === "total-blocking-time")?.overBudget).toBe(
      true
    );
  });
});

describe("formatMarkdownReport", () => {
  it("renders a row per metric with its budget and result", () => {
    const metrics = compareSamples(
      "desktop",
      [sample({ "largest-contentful-paint": 4000 })],
      [sample()]
    );
    const report = formatMarkdownReport(
      "http://localhost:3000",
      "https://repolore.app",
      [{ path: "/", profile: "desktop", metrics }]
    );
    expect(report).toContain("### `/` (desktop)");
    expect(report).toContain(
      "| LCP | 1500 ms | 4000 ms | 1000 ms | ⚠️ over budget |"
    );
    expect(report).toContain("| CLS | 0.100 | 0.000 | 0.000 | ✅ |");
    expect(report).toContain("| TTFB | 500 ms | 100 ms | 100 ms | info |");
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
    profile: "desktop",
    metrics: compareSamples(
      "desktop",
      [sample({ "largest-contentful-paint": 4000, "speed-index": 2000 })],
      // Production is over the Speed Index budget too, not the LCP one.
      [sample({ "speed-index": 1800 })]
    ),
  };
  const clean: PageComparison = {
    path: "/",
    profile: "mobile",
    metrics: compareSamples("mobile", [sample()], [sample()]),
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

  it("lists only metrics over budget as breaches", () => {
    expect(breachesOf([breaching, clean])).toEqual([
      {
        path: "/explore",
        profile: "desktop",
        id: "largest-contentful-paint",
        budget: 1500,
        target: 4000,
        production: 1000,
        productionOverBudget: false,
      },
      {
        path: "/explore",
        profile: "desktop",
        id: "speed-index",
        budget: 1500,
        target: 2000,
        production: 1800,
        productionOverBudget: true,
      },
    ]);
  });

  it("reports breaches as non-blocking with a link to open a ticket", () => {
    const body = formatPrComment([breaching, clean], context, "FULL REPORT");
    expect(body.startsWith(PR_COMMENT_MARKER)).toBe(true);
    expect(body).toContain("2 metric(s) over budget");
    expect(body).toContain("This doesn't block merging.");
    expect(body).toContain(
      "| `/explore` | desktop | LCP | 1500 ms | 4000 ms | 1000 ms |"
    );
    expect(body).toContain(
      "| `/explore` | desktop | Speed Index | 1500 ms | 2000 ms | 1800 ms (also over) |"
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
    expect(body).toContain("No metrics over budget");
    expect(body).not.toContain("FULL REPORT");
  });

  it("pre-fills the new issue with the breaches and the run", () => {
    const url = new URL(newIssueUrl(breachesOf([breaching]), context)!);
    expect(url.pathname).toBe("/nielse63/RepoLore/issues/new");
    expect(url.searchParams.get("title")).toBe(
      "Performance: 2 metric(s) over budget (PR #36)"
    );
    const body = url.searchParams.get("body");
    expect(body).toContain("| `/explore` | desktop | LCP | 1500 ms |");
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
