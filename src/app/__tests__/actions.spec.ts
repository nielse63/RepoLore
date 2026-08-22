import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { analyzeAndPersistRepository } from "@/analysis/analyze-and-persist";
import { RateLimitedError } from "@/analysis/reanalysis-rate-limit";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { GitHubApiError } from "@/github/client";
import { resolveRepository, reanalyzeRepository } from "../actions";

jest.mock("next/navigation");
jest.mock("next/cache");
jest.mock("@/analysis/analyze-and-persist");
jest.mock("@/db/analysis-runs");

const mockRedirect = redirect as jest.MockedFunction<typeof redirect>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;
const mockAnalyzeAndPersistRepository =
  analyzeAndPersistRepository as jest.MockedFunction<
    typeof analyzeAndPersistRepository
  >;
const mockGetLatestAnalysisRunForRepo =
  getLatestAnalysisRunForRepo as jest.MockedFunction<
    typeof getLatestAnalysisRunForRepo
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
  it("reports changed: true when the new run has a different id than the previous one", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({
      id: 1,
    } as never);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 2 } as never);

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", changed: true });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/lore/acme/widgets");
  });

  it("reports changed: false when the run short-circuited to the same id", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({ id: 1 } as never);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 1 } as never);

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", changed: false });
  });

  it("reports changed: true when there was no previous run", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue(null);
    mockAnalyzeAndPersistRepository.mockResolvedValue({ id: 1 } as never);

    const result = await reanalyzeRepository(
      "acme",
      "widgets",
      { status: "idle" },
      new FormData()
    );

    expect(result).toEqual({ status: "done", changed: true });
  });

  it("returns an error message instead of revalidating when analysis fails", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue(null);
    mockAnalyzeAndPersistRepository.mockRejectedValue(
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
    mockGetLatestAnalysisRunForRepo.mockResolvedValue(null);
    const error = new Error("boom");
    mockAnalyzeAndPersistRepository.mockRejectedValue(error);
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
