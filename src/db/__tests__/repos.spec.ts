import { getDbPool } from "../client";
import { upsertRepo } from "../repos";

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
