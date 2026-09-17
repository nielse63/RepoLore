import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analyzeAndPersistRepository } from "@/analysis/analyze-and-persist";
import { reanalyzeAndRefreshHistory } from "@/analysis/reanalyze-and-refresh-history";
import { RateLimitedError } from "@/analysis/reanalysis-rate-limit";
import { GitHubApiError } from "@/github/client";
import { resolveRepository, reanalyzeRepository } from "../actions";

jest.mock("next/navigation");
jest.mock("next/cache");
jest.mock("@/analysis/analyze-and-persist");
jest.mock("@/analysis/reanalyze-and-refresh-history");

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

function formDataWithUrl(url: string): FormData {
  const formData = new FormData();
  formData.set("url", url);
  return formData;
}

describe("resolveRepository", () => {
  it("returns an error without analyzing when the URL is invalid", async () => {
    const result = await resolveRepository(
      { status: "idle" },
      formDataWithUrl("not a url")
    );

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
