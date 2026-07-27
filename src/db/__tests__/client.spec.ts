import { Pool } from "pg";
import { getDbPool } from "../client";

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation((config) => ({ __config: config })),
}));

const MockPool = Pool as unknown as jest.Mock;

describe("getDbPool", () => {
  const originalUrl = process.env.DATABASE_URL;

  afterAll(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  // Order matters: this must run before any test creates the module-level
  // singleton pool, since getDbPool() has no way to reset it.
  it("throws when DATABASE_URL is not configured", () => {
    delete process.env.DATABASE_URL;

    expect(() => getDbPool()).toThrow("No DATABASE_URL is configured");
    expect(MockPool).not.toHaveBeenCalled();
  });

  it("creates a Pool with the configured connection string, and reuses it (singleton)", () => {
    process.env.DATABASE_URL = "postgres://localhost/test";

    const first = getDbPool();
    const second = getDbPool();

    expect(MockPool).toHaveBeenCalledTimes(1);
    expect(MockPool).toHaveBeenCalledWith({
      connectionString: "postgres://localhost/test",
    });
    expect(first).toBe(second);
  });
});
