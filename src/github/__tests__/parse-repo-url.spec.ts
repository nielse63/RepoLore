import { parseGitHubRepoUrl } from "../parse-repo-url";

describe("parseGitHubRepoUrl", () => {
  it("rejects empty input", () => {
    const result = parseGitHubRepoUrl("   ");
    expect(result).toEqual({
      ok: false,
      reason: "A GitHub URL is required.",
    });
  });

  it("rejects unparseable input", () => {
    const result = parseGitHubRepoUrl("::::");
    expect(result.ok).toBe(false);
  });

  it("rejects non-http(s) protocols", () => {
    const result = parseGitHubRepoUrl("ftp://github.com/owner/repo");
    expect(result).toEqual({
      ok: false,
      reason: "Only http(s) GitHub repository URLs are supported.",
    });
  });

  it("rejects non-github.com hosts", () => {
    const result = parseGitHubRepoUrl("https://gitlab.com/owner/repo");
    expect(result).toEqual({
      ok: false,
      reason: "Only github.com repository URLs are supported.",
    });
  });

  it("rejects a URL missing a repo segment", () => {
    const result = parseGitHubRepoUrl("https://github.com/owner");
    expect(result).toEqual({
      ok: false,
      reason:
        "The URL must include an owner and repository name, e.g. github.com/owner/repo.",
    });
  });

  it("rejects an invalid owner name", () => {
    const result = parseGitHubRepoUrl("https://github.com/-bad-/repo");
    expect(result).toEqual({
      ok: false,
      reason: "“-bad-” isn’t a valid GitHub owner name.",
    });
  });

  it("rejects an invalid repo name", () => {
    const result = parseGitHubRepoUrl("https://github.com/owner/bad$repo");
    expect(result.ok).toBe(false);
  });

  it("parses a full https URL", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo")).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });

  it("accepts input with no scheme", () => {
    expect(parseGitHubRepoUrl("github.com/owner/repo")).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });

  it("accepts a www. host", () => {
    expect(parseGitHubRepoUrl("https://www.github.com/owner/repo")).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });

  it("strips a trailing .git suffix", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo.git")).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });

  it("ignores extra path segments like /tree/main", () => {
    expect(
      parseGitHubRepoUrl("https://github.com/owner/repo/tree/main/src")
    ).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });

  it("ignores a trailing slash", () => {
    expect(parseGitHubRepoUrl("https://github.com/owner/repo/")).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseGitHubRepoUrl("  https://github.com/owner/repo  ")).toEqual({
      ok: true,
      value: { owner: "owner", repo: "repo" },
    });
  });
});
