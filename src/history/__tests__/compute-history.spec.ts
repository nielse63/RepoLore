import type { Lore } from "@/lore/model";
import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import { listCommitsSince, fetchCommitDetail } from "@/github/commits";
import { buildHistoryEntries } from "../classify";
import { computeHistory } from "../compute-history";

jest.mock("@/db/analysis-runs");
jest.mock("@/github/commits");
jest.mock("../classify");

const mockGetLatestAnalysisRunForRepo =
  getLatestAnalysisRunForRepo as jest.MockedFunction<
    typeof getLatestAnalysisRunForRepo
  >;
const mockListCommitsSince = listCommitsSince as jest.MockedFunction<
  typeof listCommitsSince
>;
const mockFetchCommitDetail = fetchCommitDetail as jest.MockedFunction<
  typeof fetchCommitDetail
>;
const mockBuildHistoryEntries = buildHistoryEntries as jest.MockedFunction<
  typeof buildHistoryEntries
>;

function makeLore(commitSha: string, defaultBranch: string): Lore {
  return {
    snapshot: {
      id: "snap-1",
      repository: {
        owner: "acme",
        name: "widgets",
        defaultBranch,
        url: "https://github.com/acme/widgets",
        isPrivate: false,
      },
      commitSha,
      analyzedAt: "2026-08-01T00:00:00Z",
      analyzerVersion: "v1",
      status: "completed",
    },
    projects: [],
    structuralAreas: [],
    entryPoints: [],
    relationships: [],
    publicContracts: [],
    testRelationships: [],
    externalDependencies: [],
    callableSignatures: [],
    callEdges: [],
    behaviorNodes: [],
    behaviorEdges: [],
    functionImportance: [],
    startHere: [],
    findings: [],
    gaps: [],
  };
}

describe("computeHistory", () => {
  it("returns an empty, honest result when there is no analysis run yet", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue(null);

    const result = await computeHistory("acme", "widgets");

    expect(result).toEqual({
      entries: [],
      computedThroughSha: "",
      truncated: false,
    });
    expect(mockListCommitsSince).not.toHaveBeenCalled();
  });

  it("returns an empty result when the latest run has no persisted Lore result", async () => {
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({
      id: 1,
      repoId: 1,
      commitSha: "abc",
      analyzerVersion: "v1",
      status: "failed",
      result: null,
      errorMessage: "boom",
      createdAt: "2026-08-01T00:00:00Z",
    });

    const result = await computeHistory("acme", "widgets");

    expect(result).toEqual({
      entries: [],
      computedThroughSha: "",
      truncated: false,
    });
    expect(mockListCommitsSince).not.toHaveBeenCalled();
  });

  it("lists commits since the lookback window on the analyzed default branch, fetches each detail, and classifies them", async () => {
    const lore = makeLore("headsha", "develop");
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({
      id: 1,
      repoId: 1,
      commitSha: "headsha",
      analyzerVersion: "v1",
      status: "completed",
      result: lore,
      errorMessage: null,
      createdAt: "2026-08-01T00:00:00Z",
    });
    mockListCommitsSince.mockResolvedValue({
      commits: [
        {
          sha: "c1",
          message: "first",
          authorName: "Ava",
          authoredAt: "2026-08-20T00:00:00Z",
        },
        {
          sha: "c2",
          message: "second",
          authorName: "Ben",
          authoredAt: "2026-08-19T00:00:00Z",
        },
      ],
      truncated: false,
    });
    mockFetchCommitDetail.mockImplementation(async (_owner, _repo, sha) => ({
      sha,
      files: [],
    }));
    mockBuildHistoryEntries.mockReturnValue([]);

    const result = await computeHistory("acme", "widgets");

    expect(mockListCommitsSince).toHaveBeenCalledWith(
      "acme",
      "widgets",
      expect.objectContaining({ branch: "develop" })
    );
    expect(mockFetchCommitDetail).toHaveBeenCalledTimes(2);
    expect(mockFetchCommitDetail).toHaveBeenCalledWith("acme", "widgets", "c1");
    expect(mockFetchCommitDetail).toHaveBeenCalledWith("acme", "widgets", "c2");
    expect(mockBuildHistoryEntries).toHaveBeenCalledWith(
      [
        {
          commit: expect.objectContaining({ sha: "c1" }),
          detail: { sha: "c1", files: [] },
        },
        {
          commit: expect.objectContaining({ sha: "c2" }),
          detail: { sha: "c2", files: [] },
        },
      ],
      lore
    );
    expect(result.computedThroughSha).toBe("headsha");
    expect(result.truncated).toBe(false);
  });

  it("preserves commit order in the classified pairs even when detail fetches resolve out of order", async () => {
    const lore = makeLore("headsha", "main");
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({
      id: 1,
      repoId: 1,
      commitSha: "headsha",
      analyzerVersion: "v1",
      status: "completed",
      result: lore,
      errorMessage: null,
      createdAt: "2026-08-01T00:00:00Z",
    });
    const commits = ["c1", "c2", "c3"].map((sha) => ({
      sha,
      message: sha,
      authorName: "Ava",
      authoredAt: "2026-08-20T00:00:00Z",
    }));
    mockListCommitsSince.mockResolvedValue({ commits, truncated: false });

    const delayBySha: Record<string, number> = { c1: 15, c2: 5, c3: 10 };
    mockFetchCommitDetail.mockImplementation(
      (_owner, _repo, sha) =>
        new Promise((resolve) =>
          setTimeout(
            () => resolve({ sha, files: [] }),
            delayBySha[sha as string]
          )
        )
    );
    mockBuildHistoryEntries.mockReturnValue([]);

    await computeHistory("acme", "widgets");

    const [passedPairs] = mockBuildHistoryEntries.mock.calls[0];
    expect(passedPairs.map((p) => p.commit.sha)).toEqual(["c1", "c2", "c3"]);
    expect(passedPairs.map((p) => p.detail.sha)).toEqual(["c1", "c2", "c3"]);
  });

  it("passes through truncated: true from the commit listing", async () => {
    const lore = makeLore("headsha", "main");
    mockGetLatestAnalysisRunForRepo.mockResolvedValue({
      id: 1,
      repoId: 1,
      commitSha: "headsha",
      analyzerVersion: "v1",
      status: "completed",
      result: lore,
      errorMessage: null,
      createdAt: "2026-08-01T00:00:00Z",
    });
    mockListCommitsSince.mockResolvedValue({ commits: [], truncated: true });
    mockBuildHistoryEntries.mockReturnValue([]);

    const result = await computeHistory("acme", "widgets");

    expect(result.truncated).toBe(true);
  });
});
