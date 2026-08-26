import { getDbPool } from "../client";
import {
  saveAnalysisRun,
  getAnalysisRunByKey,
  getLatestAnalysisRunForRepo,
} from "../analysis-runs";

jest.mock("../client");

const mockGetDbPool = getDbPool as jest.MockedFunction<typeof getDbPool>;

const rawRow = {
  id: "1",
  repo_id: "2",
  commit_sha: "sha123",
  analyzer_version: "v1",
  status: "completed" as const,
  result: null,
  error_message: null,
  created_at: "2026-01-01T00:00:00Z",
};

const mappedRow = {
  id: 1,
  repoId: 2,
  commitSha: "sha123",
  analyzerVersion: "v1",
  status: "completed",
  result: null,
  errorMessage: null,
  createdAt: "2026-01-01T00:00:00Z",
};

describe("saveAnalysisRun", () => {
  it("inserts a new run and returns it mapped, serializing the result to JSON", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const lore = { snapshot: {} } as never;
    const result = await saveAnalysisRun({
      repoId: 2,
      commitSha: "sha123",
      analyzerVersion: "v1",
      status: "completed",
      result: lore,
    });

    expect(result).toEqual(mappedRow);
    expect(query).toHaveBeenCalledTimes(1);
    const [, params] = query.mock.calls[0];
    expect(params).toEqual([
      2,
      "sha123",
      "v1",
      "completed",
      JSON.stringify(lore),
      null,
    ]);
  });

  it("passes null for result and errorMessage when omitted", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await saveAnalysisRun({
      repoId: 2,
      commitSha: "sha123",
      analyzerVersion: "v1",
      status: "failed",
    });

    const [, params] = query.mock.calls[0];
    expect(params).toEqual([2, "sha123", "v1", "failed", null, null]);
  });

  it("falls back to the existing row on a conflict (idempotent insert)", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // insert conflicts, nothing returned
      .mockResolvedValueOnce({ rows: [rawRow] }); // getAnalysisRunByKey lookup
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await saveAnalysisRun({
      repoId: 2,
      commitSha: "sha123",
      analyzerVersion: "v1",
      status: "completed",
    });

    expect(result).toEqual(mappedRow);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("throws if the conflict fallback lookup finds nothing", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(
      saveAnalysisRun({
        repoId: 2,
        commitSha: "sha123",
        analyzerVersion: "v1",
        status: "completed",
      })
    ).rejects.toThrow("insert was skipped as a conflict");
  });
});

describe("getAnalysisRunByKey", () => {
  it("returns the mapped row when found", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getAnalysisRunByKey(2, "sha123", "v1");
    expect(result).toEqual(mappedRow);
    expect(query).toHaveBeenCalledWith(expect.any(String), [2, "sha123", "v1"]);
  });

  it("returns null when no row is found", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getAnalysisRunByKey(2, "sha123", "v1");
    expect(result).toBeNull();
  });
});

describe("getLatestAnalysisRunForRepo", () => {
  it("returns the mapped latest row for the repo", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getLatestAnalysisRunForRepo("acme", "repo");
    expect(result).toEqual(mappedRow);
    expect(query).toHaveBeenCalledWith(expect.any(String), ["acme", "repo"]);
  });

  it("returns null when the repo has no runs", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getLatestAnalysisRunForRepo("acme", "repo");
    expect(result).toBeNull();
  });

  it("backfills externalDependencies to [] for a pre-existing result stored before that field existed", async () => {
    const preExistingResult = { snapshot: {}, projects: [] } as never;
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ ...rawRow, result: preExistingResult }] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getLatestAnalysisRunForRepo("acme", "repo");
    expect(result?.result?.externalDependencies).toEqual([]);
  });

  it("backfills behaviorNodes/behaviorEdges/functionImportance to [] for a pre-existing result stored before ADR-0013", async () => {
    const preExistingResult = { snapshot: {}, projects: [] } as never;
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ ...rawRow, result: preExistingResult }] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getLatestAnalysisRunForRepo("acme", "repo");
    expect(result?.result?.behaviorNodes).toEqual([]);
    expect(result?.result?.behaviorEdges).toEqual([]);
    expect(result?.result?.functionImportance).toEqual([]);
  });
});
