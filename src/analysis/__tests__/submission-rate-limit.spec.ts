import { getDbPool } from "@/db/client";
import {
  claimSubmissionAttempt,
  SubmissionRateLimitedError,
  SUBMISSION_COOLDOWN_SECONDS,
} from "../submission-rate-limit";

jest.mock("@/db/client");

const mockGetDbPool = getDbPool as jest.MockedFunction<typeof getDbPool>;

describe("claimSubmissionAttempt", () => {
  it("resolves without throwing when the INSERT/UPDATE claims a row", async () => {
    const query = jest
      .fn()
      .mockResolvedValue({ rows: [{ identifier: "1.2.3.4" }] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(claimSubmissionAttempt("1.2.3.4")).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      "1.2.3.4",
      SUBMISSION_COOLDOWN_SECONDS,
    ]);
  });

  it("throws SubmissionRateLimitedError with the remaining seconds when the claim fails", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ seconds_remaining: 7 }] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(claimSubmissionAttempt("1.2.3.4")).rejects.toMatchObject({
      name: "SubmissionRateLimitedError",
      retryAfterSeconds: 7,
    });
  });

  it("falls back to the default cooldown when the identifier row is missing", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    mockGetDbPool.mockReturnValue({ query } as never);

    await expect(claimSubmissionAttempt("1.2.3.4")).rejects.toMatchObject({
      retryAfterSeconds: SUBMISSION_COOLDOWN_SECONDS,
    });
  });
});

describe("SubmissionRateLimitedError", () => {
  it("produces a human-readable message including the wait time", () => {
    const error = new SubmissionRateLimitedError(10);
    expect(error.name).toBe("SubmissionRateLimitedError");
    expect(error.message).toContain("10s");
  });
});
