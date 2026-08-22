import { getDbPool } from "../client";
import {
  getHistoryEntriesForRepo,
  getHistoryEntriesForRepoByName,
  saveHistoryEntries,
} from "../history-entries";

jest.mock("../client");

const mockGetDbPool = getDbPool as jest.MockedFunction<typeof getDbPool>;

const rawRow = {
  id: "1",
  repo_id: "2",
  computed_through_sha: "sha123",
  entries: [],
  computed_at: "2026-08-20T00:00:00Z",
};

const mappedRow = {
  id: 1,
  repoId: 2,
  computedThroughSha: "sha123",
  entries: [],
  computedAt: "2026-08-20T00:00:00Z",
};

describe("saveHistoryEntries", () => {
  it("upserts on repo_id and returns the mapped row", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await saveHistoryEntries({
      repoId: 2,
      computedThroughSha: "sha123",
      entries: [],
    });

    expect(result).toEqual(mappedRow);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(repo_id\) DO UPDATE/);
    expect(params).toEqual([2, "sha123", "[]"]);
  });
});

describe("getHistoryEntriesForRepo", () => {
  it("returns null when no cached row exists", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    expect(await getHistoryEntriesForRepo(2)).toBeNull();
  });

  it("returns the mapped row when one exists", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    expect(await getHistoryEntriesForRepo(2)).toEqual(mappedRow);
  });
});

describe("getHistoryEntriesForRepoByName", () => {
  it("joins on owner/name and returns the mapped row", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [rawRow] });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await getHistoryEntriesForRepoByName(
      "acme",
      "payments-service"
    );
    expect(result).toEqual(mappedRow);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/JOIN repos r ON r.id = h.repo_id/);
    expect(params).toEqual(["acme", "payments-service"]);
  });
});
