import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analyzeAndPersistRepository } from "@/analysis/analyze-and-persist";
import { reanalyzeAndRefreshHistory } from "@/analysis/reanalyze-and-refresh-history";
import { RateLimitedError } from "@/analysis/reanalysis-rate-limit";
import {
  SubmissionRateLimitedError,
  claimSubmissionAttempt,
} from "@/analysis/submission-rate-limit";
import { saveHistoryEntries } from "@/db/history-entries";
import { upsertRepo } from "@/db/repos";
import { GitHubApiError } from "@/github/client";
import { computeHistory } from "@/history/compute-history";
import {
  HistoryRateLimitedError,
  claimHistoryRefresh,
} from "@/history/history-rate-limit";
import { requestIdentifier } from "@/lib/request-identifier";
import {
  resolveRepository,
  reanalyzeRepository,
  refreshHistory,
} from "../actions";

jest.mock("next/navigation");
jest.mock("next/cache");
jest.mock("@/analysis/analyze-and-persist");
jest.mock("@/analysis/reanalyze-and-refresh-history");
// A plain `jest.mock("@/analysis/submission-rate-limit")` would auto-mock
// `SubmissionRateLimitedError` too, replacing its real constructor (which
// sets `.message`) with a no-op — breaking the
// `error instanceof SubmissionRateLimitedError` test below, which relies on
// the real class. Only `claimSubmissionAttempt` needs mocking.
jest.mock("@/analysis/submission-rate-limit", () => ({
  ...jest.requireActual("@/analysis/submission-rate-limit"),
  claimSubmissionAttempt: jest.fn(),
}));
jest.mock("@/db/history-entries");
jest.mock("@/db/repos");
jest.mock("@/history/compute-history");
// Same reasoning as submission-rate-limit above: keep the real
// HistoryRateLimitedError class so `error instanceof HistoryRateLimitedError`
// still works, and only mock the function that throws it.
jest.mock("@/history/history-rate-limit", () => ({
  ...jest.requireActual("@/history/history-rate-limit"),
  claimHistoryRefresh: jest.fn(),
}));
jest.mock("@/lib/request-identifier");

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;
const mockAnalyzeAndPersistRepository =
  analyzeAndPersistRepository as jest.MockedFunction<
    typeof analyzeAndPersistRepository
  >;
const mockReanalyzeAndRefreshHistory =
  reanalyzeAndRefreshHistory as jest.MockedFunction<
    typeof reanalyzeAndRefreshHistory
  >;
const mockClaimSubmissionAttempt =
  claimSubmissionAttempt as jest.MockedFunction<typeof claimSubmissionAttempt>;
const mockRequestIdentifier = requestIdentifier as jest.MockedFunction<
  typeof requestIdentifier
>;
const mockSaveHistoryEntries = saveHistoryEntries as jest.MockedFunction<
  typeof saveHistoryEntries
>;
const mockUpsertRepo = upsertRepo as jest.MockedFunction<typeof upsertRepo>;
const mockComputeHistory = computeHistory as jest.MockedFunction<
  typeof computeHistory
>;
const mockClaimHistoryRefresh = claimHistoryRefresh as jest.MockedFunction<
  typeof claimHistoryRefresh
>;

function formDataWithUrl(url: string): FormData {
  const formData = new FormData();
  formData.set("url", url);
  return formData;
}

describe("resolveRepository", () => {
  beforeEach(() => {
    mockRequestIdentifier.mockResolvedValue("1.2.3.4");
    mockClaimSubmissionAttempt.mockResolvedValue(undefined);
  });

  it("returns an error without analyzing when the URL is invalid", async () => {
    const result = await resolveRepository(
      { status: "idle" },
      formDataWithUrl("not a url")
    );

    expect(result.status).toBe("error");
    expect(mockAnalyzeAndPersistRepository).not.toHaveBeenCalled();
  });

  it("returns an error without analyzing when the url field is missing", async () => {
    const result = await resolveRepository({ status: "idle" }, new FormData());

    expect(result.status).toBe("error");
    expect(mockAnalyzeAndPersistRepository).not.toHaveBeenCalled();
  });

  it("analyzes and redirects to the Lore page on success", async () => {
    mockAnalyzeAndPersistRepository.mockResolvedValue({} as never);

    await resolveRepository(
      { status: "idle" },
      formDataWithUrl("https://github.com/acme/widgets")
    );

    expect(mockAnalyzeAndPersistRepository).toHaveBeenCalledWith(
      "acme",
      "widgets"
    );
    expect(mockRedirect).toHaveBeenCalledWith("/lore/acme/widgets");
  });

  it("returns the GitHubApiError message inline instead of redirecting", async () => {
    mockAnalyzeAndPersistRepository.mockRejectedValue(
      new GitHubApiError("not-found", "Repository not found")
    );

    const result = await resolveRepository(
      { status: "idle" },
      formDataWithUrl("https://github.com/acme/widgets")
    );

    expect(result).toEqual({
      status: "error",
      message: "Repository not found",
    });
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns the RateLimitedError message inline instead of redirecting", async () => {
    mockAnalyzeAndPersistRepository.mockRejectedValue(new RateLimitedError(30));

    const result = await resolveRepository(
      { status: "idle" },
      formDataWithUrl("https://github.com/acme/widgets")
    );

    expect(result.status).toBe("error");
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns the SubmissionRateLimitedError message inline without ever analyzing", async () => {
    mockClaimSubmissionAttempt.mockRejectedValue(
      new SubmissionRateLimitedError(10)
    );

    const result = await resolveRepository(
      { status: "idle" },
      formDataWithUrl("https://github.com/acme/widgets")
    );

    expect(result).toEqual({
      status: "error",
      message: "Please wait 10s before submitting another repository.",
    });
    expect(mockAnalyzeAndPersistRepository).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns a generic error message for unexpected failures", async () => {
    const error = new Error("boom");
    mockAnalyzeAndPersistRepository.mockRejectedValue(error);
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    const result = await resolveRepository(
      { status: "idle" },
      formDataWithUrl("https://github.com/acme/widgets")
    );

    expect(result).toEqual({
      status: "error",
      message: "Something went wrong analyzing that repository.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("acme/widgets"),
      error
    );
    consoleError.mockRestore();
  });
});

describe("reanalyzeRepository", () => {
  // Deeper behavior of "did analysis produce a new run" and "was History's
  // cache actually recomputed" now lives in
  // reanalyze-and-refresh-history.spec.ts, since reanalyzeAndRefreshHistory
  // is the module that owns that logic (shared with the background
  // re-analysis trigger, ADR-0013). This suite only covers what this Server
  // Action itself still does: map that result to revalidatePath calls and
  // to a ReanalyzeState.
  it("revalidates the Lore page, and History only when it was actually refreshed", async () => {
    mockReanalyzeAndRefreshHistory.mockResolvedValue({
      run: { id: 2 } as never,
      changed: true,
      historyRefreshed: true,
    });

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", changed: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/lore/acme/widgets");
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/lore/acme/widgets/history"
    );
  });

  it("does not revalidate History when changed but the history refresh itself failed", async () => {
    mockReanalyzeAndRefreshHistory.mockResolvedValue({
      run: { id: 2 } as never,
      changed: true,
      historyRefreshed: false,
    });

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", changed: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/lore/acme/widgets");
    expect(mockRevalidatePath).not.toHaveBeenCalledWith(
      "/lore/acme/widgets/history"
    );
  });

  it("reports changed: false and does not revalidate History when the run short-circuited to the same id", async () => {
    mockReanalyzeAndRefreshHistory.mockResolvedValue({
      run: { id: 1 } as never,
      changed: false,
      historyRefreshed: false,
    });

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", changed: false });
    expect(mockRevalidatePath).not.toHaveBeenCalledWith(
      "/lore/acme/widgets/history"
    );
  });

  it("returns an error message instead of revalidating when analysis fails", async () => {
    mockReanalyzeAndRefreshHistory.mockRejectedValue(
      new GitHubApiError("rate-limited", "Rate limit exceeded")
    );

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "error", message: "Rate limit exceeded" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error message for unexpected failures", async () => {
    const error = new Error("boom");
    mockReanalyzeAndRefreshHistory.mockRejectedValue(error);
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Something went wrong re-analyzing that repository.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("acme/widgets"),
      error
    );
    consoleError.mockRestore();
  });
});

describe("refreshHistory", () => {
  beforeEach(() => {
    mockUpsertRepo.mockResolvedValue({ id: 42 } as never);
    mockClaimHistoryRefresh.mockResolvedValue(undefined);
  });

  it("computes, saves, and revalidates History on success", async () => {
    mockComputeHistory.mockResolvedValue({
      entries: [{ id: "e1" }, { id: "e2" }] as never,
      computedThroughSha: "sha1",
      truncated: false,
    });
    mockSaveHistoryEntries.mockResolvedValue({} as never);

    const result = await refreshHistory(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", entryCount: 2 });
    expect(mockUpsertRepo).toHaveBeenCalledWith("acme", "widgets");
    expect(mockClaimHistoryRefresh).toHaveBeenCalledWith(42);
    expect(mockComputeHistory).toHaveBeenCalledWith("acme", "widgets");
    expect(mockSaveHistoryEntries).toHaveBeenCalledWith({
      repoId: 42,
      computedThroughSha: "sha1",
      entries: [{ id: "e1" }, { id: "e2" }],
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith(
      "/lore/acme/widgets/history"
    );
  });

  it("returns the GitHubApiError message inline instead of saving", async () => {
    mockComputeHistory.mockRejectedValue(
      new GitHubApiError("rate-limited", "Rate limit exceeded")
    );

    const result = await refreshHistory(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "error", message: "Rate limit exceeded" });
    expect(mockSaveHistoryEntries).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns the HistoryRateLimitedError message inline without ever computing", async () => {
    mockClaimHistoryRefresh.mockRejectedValue(new HistoryRateLimitedError(45));

    const result = await refreshHistory(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Please wait 45s before refreshing history again.",
    });
    expect(mockComputeHistory).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error message for unexpected failures", async () => {
    const error = new Error("boom");
    mockComputeHistory.mockRejectedValue(error);
    const consoleError = jest.spyOn(console, "error").mockImplementation();

    const result = await refreshHistory(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({
      status: "error",
      message: "Something went wrong refreshing history.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("acme/widgets"),
      error
    );
    consoleError.mockRestore();
  });
});
