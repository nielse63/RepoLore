import isAnalysisStale, {
  STALE_ANALYSIS_THRESHOLD_SECONDS,
} from "../is-analysis-stale";

describe("isAnalysisStale", () => {
  const now = new Date("2026-09-16T12:00:00.000Z");

  it("is not stale just under the threshold", () => {
    const analyzedAt = new Date(
      now.getTime() - (STALE_ANALYSIS_THRESHOLD_SECONDS - 1) * 1000
    ).toISOString();
    expect(isAnalysisStale(analyzedAt, now)).toBe(false);
  });

  it("is stale exactly at the threshold", () => {
    const analyzedAt = new Date(
      now.getTime() - STALE_ANALYSIS_THRESHOLD_SECONDS * 1000
    ).toISOString();
    expect(isAnalysisStale(analyzedAt, now)).toBe(true);
  });

  it("is stale well past the threshold", () => {
    const analyzedAt = new Date(
      now.getTime() - 3 * STALE_ANALYSIS_THRESHOLD_SECONDS * 1000
    ).toISOString();
    expect(isAnalysisStale(analyzedAt, now)).toBe(true);
  });

  it("is not stale for a just-completed analysis", () => {
    expect(isAnalysisStale(now.toISOString(), now)).toBe(false);
  });

  it("defaults `now` to the current time", () => {
    const twoDaysAgo = new Date(
      Date.now() - 2 * STALE_ANALYSIS_THRESHOLD_SECONDS * 1000
    ).toISOString();
    expect(isAnalysisStale(twoDaysAgo)).toBe(true);
  });
});
