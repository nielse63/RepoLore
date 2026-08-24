import { resolveRepositoryHead, fetchRepositoryTarball } from "@/github/client";
import { acquireTarballSource } from "../extract-tarball";
import { acquireRepositorySource } from "../fetch-repo-source";
import { AcquisitionError } from "../errors";

jest.mock("@/github/client");
jest.mock("../extract-tarball", () => ({
  ...jest.requireActual("../extract-tarball"),
  acquireTarballSource: jest.fn(),
}));

const mockResolveRepositoryHead = resolveRepositoryHead as jest.MockedFunction<
  typeof resolveRepositoryHead
>;
const mockFetchRepositoryTarball =
  fetchRepositoryTarball as jest.MockedFunction<typeof fetchRepositoryTarball>;
const mockAcquireTarballSource = acquireTarballSource as jest.MockedFunction<
  typeof acquireTarballSource
>;

describe("acquireRepositorySource", () => {
  beforeEach(() => {
    mockResolveRepositoryHead.mockResolvedValue({
      defaultBranch: "main",
      headSha: "sha123",
      isPrivate: false,
    });
  });

  it("resolves the head, fetches the tarball at that sha, and extracts it", async () => {
    const body = {} as ReadableStream<Uint8Array>;
    mockFetchRepositoryTarball.mockResolvedValue({
      body,
    } as unknown as Response);
    const cleanup = jest.fn().mockResolvedValue(undefined);
    mockAcquireTarballSource.mockResolvedValue({
      dir: "/tmp/extracted",
      fileCount: 3,
      cleanup,
    });

    const result = await acquireRepositorySource("owner", "repo");

    expect(mockResolveRepositoryHead).toHaveBeenCalledWith("owner", "repo");
    expect(mockFetchRepositoryTarball).toHaveBeenCalledWith(
      "owner",
      "repo",
      "sha123",
      expect.any(AbortSignal)
    );
    expect(mockAcquireTarballSource).toHaveBeenCalledWith(
      body,
      expect.anything(),
      expect.any(AbortSignal)
    );
    expect(result).toEqual({
      dir: "/tmp/extracted",
      owner: "owner",
      repo: "repo",
      defaultBranch: "main",
      headSha: "sha123",
      fileCount: 3,
      cleanup,
    });
  });

  it("throws github-error when the tarball response has no body", async () => {
    mockFetchRepositoryTarball.mockResolvedValue({
      body: null,
    } as unknown as Response);

    await expect(
      acquireRepositorySource("owner", "repo")
    ).rejects.toMatchObject({
      code: "github-error",
    });
    expect(mockAcquireTarballSource).not.toHaveBeenCalled();
  });

  it("propagates errors from resolveRepositoryHead", async () => {
    mockResolveRepositoryHead.mockRejectedValue(new Error("boom"));

    await expect(acquireRepositorySource("owner", "repo")).rejects.toThrow(
      "boom"
    );
    expect(mockFetchRepositoryTarball).not.toHaveBeenCalled();
  });

  it("propagates errors from acquireTarballSource", async () => {
    mockFetchRepositoryTarball.mockResolvedValue({
      body: {} as ReadableStream<Uint8Array>,
    } as unknown as Response);
    mockAcquireTarballSource.mockRejectedValue(
      new AcquisitionError("too-many-files", "too many")
    );

    await expect(
      acquireRepositorySource("owner", "repo")
    ).rejects.toMatchObject({
      code: "too-many-files",
    });
  });

  it("times out and rejects with an AcquisitionError when the download takes too long", async () => {
    mockFetchRepositoryTarball.mockImplementation(
      (_owner, _repo, _ref, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(signal.reason);
          });
        })
    );

    await expect(
      acquireRepositorySource("owner", "repo", { timeoutMs: 5 })
    ).rejects.toMatchObject({ code: "timeout" });
  });
});
