import { getDbPool } from "../client";
import {
  findRepoIgnoringCase,
  upsertCanonicalRepo,
  upsertRepo,
} from "../repos";

jest.mock("../client");

const mockGetDbPool = getDbPool as jest.MockedFunction<typeof getDbPool>;

describe("upsertRepo", () => {
  it("inserts/upserts and maps the returned row to camelCase", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: "5",
          owner: "acme",
          name: "repo",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await upsertRepo("acme", "repo");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO repos"),
      ["acme", "repo"]
    );
    expect(result).toEqual({
      id: 5,
      owner: "acme",
      name: "repo",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });
});

describe("upsertCanonicalRepo", () => {
  it("adopts an existing case-variant row, re-spelling it to the canonical case, instead of inserting a duplicate (issue #43)", async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          id: "72",
          owner: "nielse63",
          name: "RepoLore",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await upsertCanonicalRepo("nielse63", "RepoLore");

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/UPDATE repos\s+SET owner = \$1, name = \$2/);
    expect(sql).toContain("lower(r.owner) = lower($1)");
    expect(sql).toContain("lower(r.name) = lower($2)");
    expect(params).toEqual(["nielse63", "RepoLore"]);
    expect(result).toEqual({
      id: 72,
      owner: "nielse63",
      name: "RepoLore",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("inserts a new row when no spelling of the repository exists yet", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "9",
            owner: "react",
            name: "react",
            created_at: "2026-01-01T00:00:00Z",
          },
        ],
      });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await upsertCanonicalRepo("react", "react");

    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO repos"),
      ["react", "react"]
    );
    expect(result.id).toBe(9);
  });
});

describe("findRepoIgnoringCase", () => {
  it("looks up the stored spelling case-insensitively, preferring an analyzed row", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [
        {
          id: "72",
          owner: "nielse63",
          name: "RepoLore",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    mockGetDbPool.mockReturnValue({ query } as never);

    const result = await findRepoIgnoringCase("NIELSE63", "repolore");

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("lower(r.owner) = lower($1)");
    expect(sql).toContain("lower(r.name) = lower($2)");
    expect(sql).toMatch(/ORDER BY EXISTS \(SELECT 1 FROM analysis_runs/);
    expect(params).toEqual(["NIELSE63", "repolore"]);
    expect(result).toMatchObject({ owner: "nielse63", name: "RepoLore" });
  });

  it("returns null when no spelling of the repository is stored", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(findRepoIgnoringCase("acme", "nope")).resolves.toBeNull();
  });
});
