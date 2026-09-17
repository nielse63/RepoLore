import {
  GitHubApiError,
  fetchRepositoryLanguages,
  fetchRepositoryTarball,
  resolveRepositoryHead,
} from "../client";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "status",
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe("github/client", () => {
  const originalToken = process.env.GITHUB_TOKEN;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env.GITHUB_TOKEN = originalToken;
  });

  describe("resolveRepositoryHead", () => {
    it("throws missing-token when GITHUB_TOKEN is unset", async () => {
      delete process.env.GITHUB_TOKEN;
      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "missing-token",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("resolves the default branch, HEAD sha, and description on success", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse(200, {
            default_branch: "main",
            description: "A repo",
            private: false,
          })
        )
        .mockResolvedValueOnce(jsonResponse(200, { sha: "deadbeef" }));

      const result = await resolveRepositoryHead("owner", "repo");

      expect(result).toEqual({
        defaultBranch: "main",
        headSha: "deadbeef",
        description: "A repo",
        isPrivate: false,
      });
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "https://api.github.com/repos/owner/repo",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://api.github.com/repos/owner/repo/commits/main",
        expect.anything()
      );
    });

    it("throws not-found (indistinguishable from a nonexistent repo) when the repo is private", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          default_branch: "main",
          description: "A repo",
          private: true,
        })
      );

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "not-found",
        message: expect.stringContaining("may not exist, or it may be private"),
      });
      // Never fetches the commit SHA (or anything else) for a repo it just
      // refused to resolve — GITHUB_TOKEN is a single credential shared
      // across every visitor's request, so a repo the token happens to have
      // private access to must not be acquired, analyzed, or persisted on an
      // anonymous caller's behalf.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("omits description when GitHub reports none", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse(200, { default_branch: "main", private: false })
        )
        .mockResolvedValueOnce(jsonResponse(200, { sha: "deadbeef" }));

      const result = await resolveRepositoryHead("owner", "repo");
      expect(result.description).toBeUndefined();
    });

    it("throws not-found when the repo lookup 404s", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });

    it("throws unauthorized on a 401", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "unauthorized",
      });
    });

    it("throws rate-limited on a 403 with zero remaining rate limit", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(403, {}, { "x-ratelimit-remaining": "0" })
      );

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "rate-limited",
      });
    });

    it("throws unknown for other non-ok statuses", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "unknown",
      });
    });

    it("throws unknown when the repo response omits default_branch", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "unknown",
      });
    });

    it("throws unknown when the repo response omits private", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { default_branch: "main" })
      );

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "unknown",
      });
    });

    it("throws not-found when the commit lookup 404s", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse(200, { default_branch: "main", private: false })
        )
        .mockResolvedValueOnce(jsonResponse(404, {}));

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });

    it("throws unknown when the commit response omits a sha", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse(200, { default_branch: "main", private: false })
        )
        .mockResolvedValueOnce(jsonResponse(200, {}));

      await expect(
        resolveRepositoryHead("owner", "repo")
      ).rejects.toMatchObject({
        code: "unknown",
      });
    });
  });

  describe("fetchRepositoryLanguages", () => {
    it("returns the byte-weighted language map on success", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, { Python: 495, JavaScript: 272 })
      );

      const result = await fetchRepositoryLanguages("owner", "repo");

      expect(result).toEqual({ Python: 495, JavaScript: 272 });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/languages",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("returns an empty map for a repository with no classified languages", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

      const result = await fetchRepositoryLanguages("owner", "repo");
      expect(result).toEqual({});
    });

    it("throws not-found when the languages lookup 404s", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));

      await expect(
        fetchRepositoryLanguages("owner", "repo")
      ).rejects.toMatchObject({ code: "not-found" });
    });
  });

  describe("fetchRepositoryTarball", () => {
    it("returns the raw response on success", async () => {
      const res = jsonResponse(200, {});
      fetchMock.mockResolvedValueOnce(res);

      const result = await fetchRepositoryTarball("owner", "repo", "main");
      expect(result).toBe(res);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/tarball/main",
        expect.objectContaining({ signal: undefined })
      );
    });

    it("throws not-found when the tarball 404s", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));

      await expect(
        fetchRepositoryTarball("owner", "repo", "main")
      ).rejects.toBeInstanceOf(GitHubApiError);
    });

    it("URL-encodes the ref", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

      await fetchRepositoryTarball("owner", "repo", "feature/foo");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/owner/repo/tarball/feature%2Ffoo",
        expect.anything()
      );
    });
  });
});
