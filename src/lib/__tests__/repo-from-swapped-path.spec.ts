import { repoFromSwappedPath } from "../repo-from-swapped-path";

describe("repoFromSwappedPath", () => {
  it("reads owner/repo from a swapped github.com path", () => {
    expect(repoFromSwappedPath(["vercel", "next.js"])).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("ignores trailing ref/path segments", () => {
    expect(
      repoFromSwappedPath(["vercel", "next.js", "tree", "canary", "packages"])
    ).toEqual({ owner: "vercel", repo: "next.js" });
  });

  it("accepts a github.com host prefix", () => {
    expect(repoFromSwappedPath(["github.com", "psf", "requests"])).toEqual({
      owner: "psf",
      repo: "requests",
    });
    expect(
      repoFromSwappedPath(["www.github.com", "psf", "requests.git"])
    ).toEqual({ owner: "psf", repo: "requests" });
  });

  it("rejects paths without both an owner and a repo", () => {
    expect(repoFromSwappedPath(["vercel"])).toBeNull();
    expect(repoFromSwappedPath(["github.com", "vercel"])).toBeNull();
    expect(repoFromSwappedPath([])).toBeNull();
  });

  it("rejects invalid owner names", () => {
    expect(repoFromSwappedPath([".well-known", "security.txt"])).toBeNull();
    expect(repoFromSwappedPath(["-bad", "repo"])).toBeNull();
  });

  it("rejects the app's own top-level routes as owners", () => {
    expect(repoFromSwappedPath(["lore", "x"])).toBeNull();
    expect(repoFromSwappedPath(["Explore", "x"])).toBeNull();
    expect(repoFromSwappedPath(["api", "health"])).toBeNull();
    expect(repoFromSwappedPath(["_next", "static"])).toBeNull();
  });

  it("rejects malformed percent-encoding", () => {
    expect(() => repoFromSwappedPath(["%E0%A4%A", "repo"])).not.toThrow();
    expect(repoFromSwappedPath(["%E0%A4%A", "repo"])).toBeNull();
  });
});
