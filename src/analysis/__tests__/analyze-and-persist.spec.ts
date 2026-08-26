import { acquireRepositorySource } from "@/acquisition/fetch-repo-source";
import { buildAnalyzerVersion } from "@/analysis/dispatch/version";
import { deriveJsTsViews } from "@/analysis/js-ts/derive-views";
import { extractJsTsProject } from "@/analysis/js-ts/extract-project";
import { derivePythonViews } from "@/analysis/python/derive-views";
import { extractPythonProject } from "@/analysis/python/extract-project";
import { claimReanalysisAttempt } from "@/analysis/reanalysis-rate-limit";
import {
  getAnalysisRunByKey,
  saveAnalysisRun,
  type AnalysisRunRow,
} from "@/db/analysis-runs";
import { upsertRepo } from "@/db/repos";
import {
  fetchRepositoryLanguages,
  resolveRepositoryHead,
} from "@/github/client";
import { analyzeAndPersistRepository } from "../analyze-and-persist";

jest.mock("@/acquisition/fetch-repo-source");
jest.mock("@/analysis/js-ts/derive-views");
jest.mock("@/analysis/js-ts/extract-project");
jest.mock("@/analysis/python/derive-views");
jest.mock("@/analysis/python/extract-project");
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
const mockDerivePythonViews = derivePythonViews as jest.MockedFunction<
  typeof derivePythonViews
>;
const mockExtractPythonProject = extractPythonProject as jest.MockedFunction<
  typeof extractPythonProject
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
const mockFetchRepositoryLanguages =
  fetchRepositoryLanguages as jest.MockedFunction<
    typeof fetchRepositoryLanguages
  >;

const repoRow = { id: 1, owner: "acme", name: "widgets", createdAt: "now" };

const jsTsAnalyzerVersion = buildAnalyzerVersion(["js-ts"]);
const pythonAnalyzerVersion = buildAnalyzerVersion(["python"]);
const mixedAnalyzerVersion = buildAnalyzerVersion(["js-ts", "python"]);
const unsupportedAnalyzerVersion = buildAnalyzerVersion([]);

function minimalJsTsExtraction() {
  return {
    project: {
      id: "js-ts",
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
    externalDependencies: [],
    callableSignatures: [],
    callEdges: [],
    behaviorNodes: [],
    behaviorEdges: [],
    gaps: [],
  };
}

function minimalPythonExtraction() {
  return {
    project: {
      id: "python",
      name: "widgets",
      kind: "application" as const,
      languages: ["python" as const],
      rootPath: ".",
      frameworks: [],
      evidence: [],
      gaps: [],
    },
    sourceFilePaths: ["main.py"],
    relationships: [],
    entryPoints: [],
    publicContracts: [],
    testRelationships: [],
    externalDependencies: [],
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
      isPrivate: false,
    });
    // Defaults to a pure-TypeScript language breakdown so existing
    // JS/TS-focused tests don't each need to restate it.
    mockFetchRepositoryLanguages.mockResolvedValue({ TypeScript: 100 });
    mockGetAnalysisRunByKey.mockResolvedValue(null);
  });

  it("short-circuits and returns the existing run when the commit+analyzer-set was already analyzed", async () => {
    const existing = {
      id: 5,
      status: "completed",
    } as unknown as AnalysisRunRow;
    mockGetAnalysisRunByKey.mockResolvedValue(existing);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(result).toBe(existing);
    expect(mockGetAnalysisRunByKey).toHaveBeenCalledWith(
      1,
      "sha123",
      jsTsAnalyzerVersion
    );
    expect(mockAcquireRepositorySource).not.toHaveBeenCalled();
  });

  it("rate-limits before resolving the repository head", async () => {
    const rateLimitError = new Error("rate limited");
    mockClaimReanalysisAttempt.mockRejectedValue(rateLimitError);

    await expect(
      analyzeAndPersistRepository("acme", "widgets")
    ).rejects.toThrow("rate limited");
    expect(mockResolveRepositoryHead).not.toHaveBeenCalled();
    expect(mockFetchRepositoryLanguages).not.toHaveBeenCalled();
  });

  it("propagates a head-resolution failure without persisting a run", async () => {
    mockResolveRepositoryHead.mockRejectedValue(new Error("not found"));

    await expect(
      analyzeAndPersistRepository("acme", "widgets")
    ).rejects.toThrow("not found");
    expect(mockSaveAnalysisRun).not.toHaveBeenCalled();
  });

  it("persists an honest failed run naming the detected language when nothing supported clears the threshold", async () => {
    mockFetchRepositoryLanguages.mockResolvedValue({ Go: 900, Shell: 100 });
    const failedRun = { id: 9, status: "failed" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(failedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(result).toBe(failedRun);
    expect(mockAcquireRepositorySource).not.toHaveBeenCalled();
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 1,
        commitSha: "sha123",
        analyzerVersion: unsupportedAnalyzerVersion,
        status: "failed",
        errorMessage: expect.stringContaining("Go"),
      })
    );
  });

  it("persists an honest failed run for an empty repository with no classified languages", async () => {
    mockFetchRepositoryLanguages.mockResolvedValue({});
    const failedRun = { id: 9, status: "failed" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(failedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(result).toBe(failedRun);
    expect(mockAcquireRepositorySource).not.toHaveBeenCalled();
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        analyzerVersion: unsupportedAnalyzerVersion,
        status: "failed",
        errorMessage: expect.stringContaining("empty"),
      })
    );
  });

  it("persists a failed run and does not attempt cleanup when acquisition fails", async () => {
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

  it("runs only the JS/TS extractor for a JS/TS-only repository, builds and persists the Lore, then cleans up", async () => {
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
    mockExtractJsTsProject.mockReturnValue(minimalJsTsExtraction());
    mockDeriveJsTsViews.mockReturnValue({ structuralAreas: [], startHere: [] });
    const savedRun = { id: 10, status: "partial" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(savedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(mockExtractJsTsProject).toHaveBeenCalledWith(
      "/tmp/extracted",
      "js-ts"
    );
    expect(mockDeriveJsTsViews).toHaveBeenCalled();
    expect(mockExtractPythonProject).not.toHaveBeenCalled();
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 1,
        commitSha: "sha123",
        analyzerVersion: jsTsAnalyzerVersion,
        result: expect.objectContaining({ snapshot: expect.anything() }),
      })
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(result).toBe(savedRun);
  });

  it("runs only the Python extractor for a Python-only repository (freezegun-shaped)", async () => {
    mockFetchRepositoryLanguages.mockResolvedValue({ Python: 998 });
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
    mockExtractPythonProject.mockResolvedValue(minimalPythonExtraction());
    mockDerivePythonViews.mockReturnValue({
      structuralAreas: [],
      startHere: [],
    });
    const savedRun = { id: 11, status: "partial" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(savedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    expect(mockExtractPythonProject).toHaveBeenCalledWith(
      "/tmp/extracted",
      "python"
    );
    expect(mockDerivePythonViews).toHaveBeenCalled();
    expect(mockExtractJsTsProject).not.toHaveBeenCalled();
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        analyzerVersion: pythonAnalyzerVersion,
        result: expect.objectContaining({
          projects: [expect.objectContaining({ languages: ["python"] })],
        }),
      })
    );
    expect(result).toBe(savedRun);
  });

  it("runs both extractors for a mixed-language repository above the threshold (code2flow-shaped)", async () => {
    mockFetchRepositoryLanguages.mockResolvedValue({
      Python: 495,
      JavaScript: 272,
      HTML: 233,
    });
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
    mockExtractPythonProject.mockResolvedValue(minimalPythonExtraction());
    mockDerivePythonViews.mockReturnValue({
      structuralAreas: [],
      startHere: [],
    });
    mockExtractJsTsProject.mockReturnValue(minimalJsTsExtraction());
    mockDeriveJsTsViews.mockReturnValue({ structuralAreas: [], startHere: [] });
    const savedRun = { id: 12, status: "partial" } as unknown as AnalysisRunRow;
    mockSaveAnalysisRun.mockResolvedValue(savedRun);

    const result = await analyzeAndPersistRepository("acme", "widgets");

    // Python (49.5%) is selected ahead of JS/TS (27.2%) by share, so its
    // extractor runs first and its project appears first — the primary
    // language stays `projects[0]` for any UI still reading that shorthand.
    expect(mockExtractPythonProject).toHaveBeenCalledWith(
      "/tmp/extracted",
      "python"
    );
    expect(mockExtractJsTsProject).toHaveBeenCalledWith(
      "/tmp/extracted",
      "js-ts"
    );
    expect(mockSaveAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        analyzerVersion: mixedAnalyzerVersion,
        result: expect.objectContaining({
          projects: [
            expect.objectContaining({ languages: ["python"] }),
            expect.objectContaining({ languages: ["typescript"] }),
          ],
        }),
      })
    );
    expect(result).toBe(savedRun);
  });
});
