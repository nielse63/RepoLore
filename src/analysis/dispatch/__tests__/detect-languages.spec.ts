import {
  MIN_LANGUAGE_SHARE_FOR_ANALYSIS,
  detectLanguages,
} from "../detect-languages";

describe("detectLanguages", () => {
  it("selects both js-ts and python for a genuinely mixed-language repository (code2flow-shaped)", () => {
    const result = detectLanguages({ Python: 495, JavaScript: 272, HTML: 233 });

    expect(result.supported).toBe(true);
    expect(result.selectedAnalyzers).toEqual([
      { analyzer: "python", share: 0.495 },
      { analyzer: "js-ts", share: 0.272 },
    ]);
  });

  it("selects only python for a pure-Python repository with no JS/TS files (freezegun-shaped)", () => {
    const result = detectLanguages({ Python: 998, Batchfile: 2 });

    expect(result.supported).toBe(true);
    expect(result.selectedAnalyzers).toEqual([
      { analyzer: "python", share: 0.998 },
    ]);
  });

  it("combines JavaScript and TypeScript bytes into one js-ts share", () => {
    const result = detectLanguages({ JavaScript: 60, TypeScript: 40 });

    expect(result.selectedAnalyzers).toEqual([{ analyzer: "js-ts", share: 1 }]);
  });

  it("excludes a language group below the threshold", () => {
    const result = detectLanguages({ Python: 950, JavaScript: 50 });

    expect(result.selectedAnalyzers).toEqual([
      { analyzer: "python", share: 0.95 },
    ]);
  });

  it("includes a language group exactly at the threshold", () => {
    const result = detectLanguages({ Python: 900, JavaScript: 100 });

    expect(result.selectedAnalyzers).toEqual([
      { analyzer: "python", share: 0.9 },
      { analyzer: "js-ts", share: MIN_LANGUAGE_SHARE_FOR_ANALYSIS },
    ]);
  });

  it("reports unsupported when the primary language has no matching analyzer", () => {
    const result = detectLanguages({ Go: 900, Shell: 100 });

    expect(result.supported).toBe(false);
    expect(result.selectedAnalyzers).toEqual([]);
    expect(result.languageShares[0]).toEqual({
      language: "Go",
      bytes: 900,
      share: 0.9,
    });
  });

  it("reports unsupported for an empty repository with no classified languages", () => {
    const result = detectLanguages({});

    expect(result.supported).toBe(false);
    expect(result.selectedAnalyzers).toEqual([]);
    expect(result.languageShares).toEqual([]);
  });

  it("sorts languageShares by descending share regardless of input key order", () => {
    const result = detectLanguages({ CSS: 10, Python: 80, HTML: 10 });

    expect(result.languageShares.map((l) => l.language)).toEqual([
      "Python",
      "CSS",
      "HTML",
    ]);
  });
});
