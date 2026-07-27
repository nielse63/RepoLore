import { acquireRepositorySource } from "@/acquisition/fetch-repo-source";
import { deriveJsTsViews } from "@/analysis/js-ts/derive-views";
import { extractJsTsProject } from "@/analysis/js-ts/extract-project";
import { claimReanalysisAttempt } from "@/analysis/reanalysis-rate-limit";
import {
  getAnalysisRunByKey,
  saveAnalysisRun,
  type AnalysisRunRow,
} from "@/db/analysis-runs";
import { upsertRepo } from "@/db/repos";
import { resolveRepositoryHead } from "@/github/client";
import { analyzeAndPersistRepository } from "../analyze-and-persist";

jest.mock("@/acquisition/fetch-repo-source");
jest.mock("@/analysis/js-ts/derive-views");
jest.mock("@/analysis/js-ts/extract-project");
jest.mock("@/analysis/reanalysis-rate-limit");
jest.mock("@/db/analysis-runs");
jest.mock("@/db/repos");
jest.mock("@/github/client");

const mockAcquireRepositorySource =
  acquireRepositorySource as jest.MockedFunction<
    typeof acquireRepositorySource
  >;
const mockDeriveJsTsViews = deriveJsTsViews as jest.MockedFunction<
  typeof deriveJsTsViews
>;
const mockExtractJsTsProject = extractJsTsProject as jest.MockedFunction<
  typeof extractJsTsProject
>;
const mockClaimReanalysisAttempt =
  claimReanalysisAttempt as jest.MockedFunction<typeof claimReanalysisAttempt>;
const mockGetAnalysisRunByKey = getAnalysisRunByKey as jest.MockedFunction<
  typeof getAnalysisRunByKey
>;
const mockSaveAnalysisRun = saveAnalysisRun as jest.MockedFunction<
  typeof saveAnalysisRun
>;
const mockUpsertRepo = upsertRepo as jest.MockedFunction<typeof upsertRepo>;
const mockResolveRepositoryHead = resolveRepositoryHead as jest.MockedFunction<
  typeof resolveRepositoryHead
>;

const repoRow = { id: 1, owner: "acme", name: "widgets", createdAt: "now" };

function minimalExtraction() {
  return {
    project: {
      id: ".",
      name: "widgets",
      kind: "application" as const,
      languages: ["typescript" as const],
      rootPath: ".",
      frameworks: [],
      evidence: [],
      gaps: [],
    },
    sourceFilePaths: ["src/index.ts"],
    relationships: [],
    entryPoints: [],
    publicContracts: [],
    testRelationships: [],
    reactComponents: [],
    gaps: [],
  };
}

describe("analyzeAndPersistRepository", () => {
  beforeEach(() => {
    mockUpsertRepo.mockResolvedValue(repoRow);
    mockClaimReanalysisAttempt.mockResolvedValue(undefined);
    mockResolveRepositoryHead.mockResolvedValue({
      defaultBranch: "main",
      headSha: "sha123",
    });
  });

  it("short-circuits and returns the existing run when the commit was already analyzed", async () => {
    const existing = {
      id: 5,
      status: "completed",
    } as unknown as AnalysisRunRow;
    mockGetAnalysisRunByKey.mockResolvedValue(existing);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(result).toBe(existing);
    expect(mockAcquireRepositorySource).not.toHaveBeenCalled();
  });

  it("rate-limits before resolving the repository head", async () => {
    const rateLimitError = new Error("rate limited");
    mockClaimReanalysisAttempt.mockRejectedValue(rateLimitError);

    await expect(
      analyzeAndPersistRepository("acme", "widgets")
    ).rejects.toThrow("rate limited");
    expect(mockResolveRepositoryHead).not.toHaveBeenCalled();
  });

  it("propagates a head-resolution failure without persisting a run", async () => {
    mockResolveRepositoryHead.mockRejectedValue(new Error("not found"));

    await expect(
      analyzeAndPersistRepository("acme", "widgets")
    ).rejects.toThrow("not found");
    expect(mockSaveAnalysisRun).not.toHaveBeenCalled();
  });

  it("persists a failed run and does not attempt cleanup when acquisition fails", async () => {
    mockGetAnalysisRunByKey.mockResolvedValue(null);
    mockAcquireRepositorySource.mockRejectedValue(
      new Error("tarball too large")
    );
    const failedRun = { id: 9, status: "failed" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(failedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(result).toBe(failedRun);
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 1,
        commitSha: "sha123",
        status: "failed",
        errorMessage: "tarball too large",
      })
    );
  });

  it("persists a failed run and still cleans up when extraction fails after acquisition", async () => {
    mockGetAnalysisRunByKey.mockResolvedValue(null);
    const cleanup = jest.fn().mockResolvedValue(undefined);
    mockAcquireRepositorySource.mockResolvedValue({
      dir: "/tmp/extracted",
      owner: "acme",
      repo: "widgets",
      defaultBranch: "main",
      headSha: "sha123",
      fileCount: 3,
      cleanup,
    });
    mockExtractJsTsProject.mockImplementation(() => {
      throw new Error("extraction blew up");
    });
    const failedRun = { id: 9, status: "failed" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(failedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(result).toBe(failedRun);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorMessage: "extraction blew up",
      })
    );
  });

  it("extracts, derives views, builds and persists the Lore, then cleans up on success", async () => {
    mockGetAnalysisRunByKey.mockResolvedValue(null);
    const cleanup = jest.fn().mockResolvedValue(undefined);
    mockAcquireRepositorySource.mockResolvedValue({
      dir: "/tmp/extracted",
      owner: "acme",
      repo: "widgets",
      defaultBranch: "main",
      headSha: "sha123",
      fileCount: 3,
      cleanup,
    });
    mockExtractJsTsProject.mockReturnValue(minimalExtraction());
    mockDeriveJsTsViews.mockReturnValue({ structuralAreas: [], startHere: [] });
    const savedRun = { id: 10, status: "partial" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(savedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(mockExtractJsTsProject).toHaveBeenCalledWith("/tmp/extracted");
    expect(mockDeriveJsTsViews).toHaveBeenCalled();
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 1,
        commitSha: "sha123",
        analyzerVersion: expect.any(String),
        result: expect.objectContaining({ snapshot: expect.anything() }),
      })
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result).toBe(savedRun);
  });
});
