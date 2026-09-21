import { headers } from "next/headers";
import { requestIdentifier } from "../request-identifier";

jest.mock("next/headers", () => ({ headers: jest.fn() }));

const mockHeaders = headers as jest.MockedFunction<typeof headers>;

function headersWith(forwardedFor: string | null) {
  return {
    get: jest.fn((name: string) =>
      name === "x-forwarded-for" ? forwardedFor : null
    ),
  } as never;
}

describe("requestIdentifier", () => {
  it("returns the first address in X-Forwarded-For", async () => {
    mockHeaders.mockResolvedValue(headersWith("203.0.113.5, 10.0.0.1"));

    await expect(requestIdentifier()).resolves.toBe("203.0.113.5");
  });

  it("trims whitespace around the first address", async () => {
    mockHeaders.mockResolvedValue(headersWith("  203.0.113.5  , 10.0.0.1"));

    await expect(requestIdentifier()).resolves.toBe("203.0.113.5");
  });

  it("falls back to a shared bucket when the header is absent", async () => {
    mockHeaders.mockResolvedValue(headersWith(null));

    await expect(requestIdentifier()).resolves.toBe("unknown");
  });

  it("falls back to a shared bucket when the header is present but empty", async () => {
    mockHeaders.mockResolvedValue(headersWith(""));

    await expect(requestIdentifier()).resolves.toBe("unknown");
  });

  it("falls back to a shared bucket when the header is only whitespace before the first comma", async () => {
    mockHeaders.mockResolvedValue(headersWith("   , 10.0.0.1"));

    await expect(requestIdentifier()).resolves.toBe("unknown");
  });

  it("returns a single address unchanged when there is no comma", async () => {
    mockHeaders.mockResolvedValue(headersWith("203.0.113.5"));

    await expect(requestIdentifier()).resolves.toBe("203.0.113.5");
  });
});
