import { getDbPool } from "@/db/client";
import {
  claimHistoryRefresh,
  HistoryRateLimitedError,
  HISTORY_REFRESH_COOLDOWN_SECONDS,
} from "../history-rate-limit";

jest.mock("@/db/client");

const mockGetDbPool = getDbPool as jest.MockedFunction<typeof getDbPool>;

describe("claimHistoryRefresh", () => {
  it("resolves without throwing when the UPDATE claims a row", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(claimHistoryRefresh(1)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      1,
      HISTORY_REFRESH_COOLDOWN_SECONDS,
    ]);
  });

  it("throws HistoryRateLimitedError with the remaining seconds when the claim fails", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ seconds_remaining: 42 }] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(claimHistoryRefresh(1)).rejects.toMatchObject({
      name: "HistoryRateLimitedError",
      retryAfterSeconds: 42,
    });
  });

  it("falls back to the default cooldown when the repo row is missing", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(claimHistoryRefresh(1)).rejects.toMatchObject({
      retryAfterSeconds: HISTORY_REFRESH_COOLDOWN_SECONDS,
    });
  });
});

describe("HistoryRateLimitedError", () => {
  it("produces a human-readable message including the wait time", () => {
    const error = new HistoryRateLimitedError(30);
    expect(error.name).toBe("HistoryRateLimitedError");
    expect(error.message).toContain("30s");
  });
});
