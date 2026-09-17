import { analyzeAndPersistRepository } from "@/analysis/analyze-and-persist";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { saveHistoryEntries } from "@/db/history-entries";
import { upsertRepo } from "@/db/repos";
import { computeHistory } from "@/history/compute-history";
import { reanalyzeAndRefreshHistory } from "../reanalyze-and-refresh-history";

jest.mock("@/analysis/analyze-and-persist");
jest.mock("@/db/analysis-runs");
jest.mock("@/db/history-entries");
jest.mock("@/db/repos");
jest.mock("@/history/compute-history");

const mockAnalyzeAndPersistRepository =
  analyzeAndPersistRepository as jest.MockedFunction<
    typeof analyzeAndPersistRepository
  >;
const mockGetLatestAnalysisRunForRepo =
  getLatestAnalysisRunForRepo as jest.MockedFunction<
    typeof getLatestAnalysisRunForRepo
  >;
const mockSaveHistoryEntries = saveHistoryEntries as jest.MockedFunction<
  typeof saveHistoryEntries
>;
const mockUpsertRepo = upsertRepo as jest.MockedFunction<typeof upsertRepo>;
const mockComputeHistory = computeHistory as jest.MockedFunction<
  typeof computeHistory
>;

describe("reanalyzeAndRefreshHistory", () => {
  beforeEach(() => {
    mockUpsertRepo.mockResolvedValue({ id: 42 } as never);
    mockComputeHistory.mockResolvedValue({
      entries: [],
      computedThroughSha: "abc123",
      truncated: false,
    });
    mockSaveHistoryEntries.mockResolvedValue({} as never);
  });

  it("reports changed: true and historyRefreshed: true when the new run has a different id than the previous one", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({ id: 1 } as never);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 2 } as never);

    const result = await reanalyzeAndRefreshHistory("acme", "widgets");

    expect(result).toEqual({
      run: { id: 2 },
      changed: true,
      historyRefreshed: true,
    });
    expect(mockComputeHistory).toHaveBeenCalledWith("acme", "widgets");
    expect(mockSaveHistoryEntries).toHaveBeenCalledWith({
      repoId: 42,
      computedThroughSha: "abc123",
      entries: [],
    });
  });

  it("reports changed: false and never attempts a history refresh when the run short-circuited to the same id", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({ id: 1 } as never);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 1 } as never);

    const result = await reanalyzeAndRefreshHistory("acme", "widgets");

    expect(result).toEqual({
      run: { id: 1 },
      changed: false,
      historyRefreshed: false,
    });
    expect(mockComputeHistory).not.toHaveBeenCalled();
    expect(mockSaveHistoryEntries).not.toHaveBeenCalled();
  });

  it("reports changed: true when there was no previous run", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue(null);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 1 } as never);

    const result = await reanalyzeAndRefreshHistory("acme", "widgets");

    expect(result.changed).toBe(true);
  });

  it("reports historyRefreshed: false and logs, without throwing, when the history recompute fails after a successful re-analysis", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({ id: 1 } as never);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 2 } as never);
    const historyError = new Error("GitHub API unavailable");
    mockComputeHistory.mockRejectedValue(historyError);
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    const result = await reanalyzeAndRefreshHistory("acme", "widgets");

    expect(result).toEqual({
      run: { id: 2 },
      changed: true,
      historyRefreshed: false,
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("history refresh failed"),
      historyError
    );
    consoleError.mockRestore();
  });

  it("propagates an analysis failure without attempting a history refresh", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue(null);
    const analysisError = new Error("boom");
    mockAnalyzeAndPersistRepository.mockRejectedValue(analysisError);

    await expect(reanalyzeAndRefreshHistory("acme", "widgets")).rejects.toBe(
      analysisError
    );
    expect(mockComputeHistory).not.toHaveBeenCalled();
  });
});
