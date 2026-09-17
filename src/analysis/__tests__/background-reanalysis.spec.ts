import { reanalyzeAndRefreshHistory } from "@/analysis/reanalyze-and-refresh-history";
import { RateLimitedError } from "@/analysis/reanalysis-rate-limit";
import { STALE_ANALYSIS_THRESHOLD_SECONDS } from "@/helpers/is-analysis-stale";
import { after } from "next/server";
import { scheduleBackgroundReanalysisIfStale } from "../background-reanalysis";

jest.mock("@/analysis/reanalyze-and-refresh-history");
jest.mock("next/server", () => ({ after: jest.fn() }));

const mockReanalyzeAndRefreshHistory =
  reanalyzeAndRefreshHistory as jest.MockedFunction<
    typeof reanalyzeAndRefreshHistory
  >;
const mockAfter = after as jest.MockedFunction<typeof after>;

const STALE_ANALYZED_AT = new Date(
  Date.now() - (STALE_ANALYSIS_THRESHOLD_SECONDS + 60) * 1000
).toISOString();
const FRESH_ANALYZED_AT = new Date().toISOString();

describe("scheduleBackgroundReanalysisIfStale", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not schedule anything when the analysis is not stale", () => {
    scheduleBackgroundReanalysisIfStale("acme", "widgets", FRESH_ANALYZED_AT);
    expect(mockAfter).not.toHaveBeenCalled();
  });

  it("schedules a background attempt via after() when stale", () => {
    scheduleBackgroundReanalysisIfStale("acme", "widgets", STALE_ANALYZED_AT);
    expect(mockAfter).toHaveBeenCalledTimes(1);
  });

  it("calls reanalyzeAndRefreshHistory from within the scheduled callback", async () => {
    mockReanalyzeAndRefreshHistory.mockResolvedValue({} as never);
    scheduleBackgroundReanalysisIfStale("acme", "widgets", STALE_ANALYZED_AT);

    const scheduled = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await scheduled();

    expect(mockReanalyzeAndRefreshHistory).toHaveBeenCalledWith(
      "acme",
      "widgets"
    );
  });

  it("silently discards a RateLimitedError from a concurrent claim", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockReanalyzeAndRefreshHistory.mockRejectedValue(new RateLimitedError(42));
    scheduleBackgroundReanalysisIfStale("acme", "widgets", STALE_ANALYZED_AT);

    const scheduled = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await expect(scheduled()).resolves.toBeUndefined();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("logs any other error rather than throwing", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockReanalyzeAndRefreshHistory.mockRejectedValue(new Error("boom"));
    scheduleBackgroundReanalysisIfStale("acme", "widgets", STALE_ANALYZED_AT);

    const scheduled = mockAfter.mock.calls[0][0] as () => Promise<void>;
    await expect(scheduled()).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("acme/widgets"),
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
});
