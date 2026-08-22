import {
  MAX_COMMITS_PER_COMPUTE,
  fetchCommitDetail,
  listCommitsSince,
} from "../commits";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "status",
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function commitListItem(sha: string, date: string) {
  return {
    sha,
    commit: { message: `commit ${sha}`, author: { name: "Ava Singh", date } },
    author: { login: "ava" },
  };
}

describe("github/commits", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe("listCommitsSince", () => {
    it("maps a single page of commits, newest first, not truncated", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, [
          commitListItem("sha1", "2026-08-20T10:00:00Z"),
          commitListItem("sha2", "2026-08-19T10:00:00Z"),
        ])
      );

      const result = await listCommitsSince("owner", "repo", {
        branch: "main",
        since: new Date("2026-08-01T00:00:00Z"),
      });

      expect(result.truncated).toBe(false);
      expect(result.commits).toEqual([
        {
          sha: "sha1",
          message: "commit sha1",
          authorName: "Ava Singh",
          authorLogin: "ava",
          authoredAt: "2026-08-20T10:00:00Z",
        },
        {
          sha: "sha2",
          message: "commit sha2",
          authorName: "Ava Singh",
          authorLogin: "ava",
          authoredAt: "2026-08-19T10:00:00Z",
        },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("paginates until a short page ends the list", async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        commitListItem(`sha-${i}`, "2026-08-20T10:00:00Z")
      );
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, fullPage))
        .mockResolvedValueOnce(
          jsonResponse(200, [
            commitListItem("sha-last", "2026-08-19T10:00:00Z"),
          ])
        );

      const result = await listCommitsSince("owner", "repo", {
        branch: "main",
        since: new Date("2026-08-01T00:00:00Z"),
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.commits).toHaveLength(101);
      expect(result.truncated).toBe(false);
    });

    it("truncates at MAX_COMMITS_PER_COMPUTE and reports it", async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) =>
        commitListItem(`sha-${i}`, "2026-08-20T10:00:00Z")
      );
      fetchMock.mockResolvedValue(jsonResponse(200, fullPage));

      const result = await listCommitsSince("owner", "repo", {
        branch: "main",
        since: new Date("2026-08-01T00:00:00Z"),
      });

      expect(result.commits).toHaveLength(MAX_COMMITS_PER_COMPUTE);
      expect(result.truncated).toBe(true);
    });

    it("throws not-found for a 404", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(404, {}));
      await expect(
        listCommitsSince("owner", "repo", {
          branch: "main",
          since: new Date(),
        })
      ).rejects.toMatchObject({ code: "not-found" });
    });
  });

  describe("fetchCommitDetail", () => {
    it("maps changed files including patch text", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          sha: "sha1",
          files: [
            {
              filename: "src/a.ts",
              status: "modified",
              additions: 3,
              deletions: 1,
              patch: "@@ -1,1 +1,3 @@\n+added",
            },
          ],
        })
      );

      const detail = await fetchCommitDetail("owner", "repo", "sha1");
      expect(detail).toEqual({
        sha: "sha1",
        files: [
          {
            filePath: "src/a.ts",
            status: "modified",
            additions: 3,
            deletions: 1,
            patch: "@@ -1,1 +1,3 @@\n+added",
          },
        ],
      });
    });

    it("omits patch (undefined) rather than erroring when GitHub truncates a large diff", async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(200, {
          sha: "sha1",
          files: [
            {
              filename: "big.txt",
              status: "modified",
              additions: 50000,
              deletions: 0,
            },
          ],
        })
      );

      const detail = await fetchCommitDetail("owner", "repo", "sha1");
      expect(detail.files[0].patch).toBeUndefined();
    });

    it("defaults to an empty files array when GitHub reports none", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { sha: "sha1" }));
      const detail = await fetchCommitDetail("owner", "repo", "sha1");
      expect(detail.files).toEqual([]);
    });
  });
});
