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

  describe("owner/repo shorthand", () => {
    it("accepts bare owner/repo with no host at all", () => {
      expect(parseGitHubRepoUrl("nielse63/RepoLore")).toEqual({
        ok: true,
        value: { owner: "nielse63", repo: "RepoLore" },
      });
    });

    it("trims surrounding whitespace on shorthand", () => {
      expect(parseGitHubRepoUrl("  owner/repo  ")).toEqual({
        ok: true,
        value: { owner: "owner", repo: "repo" },
      });
    });

    it("ignores a trailing slash on shorthand", () => {
      expect(parseGitHubRepoUrl("owner/repo/")).toEqual({
        ok: true,
        value: { owner: "owner", repo: "repo" },
      });
    });

    it("strips a trailing .git suffix on shorthand", () => {
      expect(parseGitHubRepoUrl("owner/repo.git")).toEqual({
        ok: true,
        value: { owner: "owner", repo: "repo" },
      });
    });

    it("rejects an invalid owner name given as shorthand", () => {
      expect(parseGitHubRepoUrl("-bad-/repo")).toEqual({
        ok: false,
        reason: "“-bad-” isn’t a valid GitHub owner name.",
      });
    });

    it("rejects an invalid repo name given as shorthand", () => {
      const result = parseGitHubRepoUrl("owner/bad$repo");
      expect(result.ok).toBe(false);
    });

    it("does not treat a single word as shorthand (ambiguous, no repo)", () => {
      // Unchanged from pre-shorthand behavior: with no second segment this
      // isn't shorthand-eligible, so it's parsed as a bare hostname instead.
      const result = parseGitHubRepoUrl("owner");
      expect(result).toEqual({
        ok: false,
        reason: "Only github.com repository URLs are supported.",
      });
    });

    it("does not treat a bare host-and-owner as shorthand", () => {
      // "github.com/owner" has a dot in the first segment, so it's read as
      // a host, not an owner — and still correctly rejected for missing a
      // repo segment, exactly as it was before shorthand support existed.
      const result = parseGitHubRepoUrl("github.com/owner");
      expect(result).toEqual({
        ok: false,
        reason:
          "The URL must include an owner and repository name, e.g. github.com/owner/repo.",
      });
    });

    it("still parses a full URL rather than misreading it as shorthand", () => {
      expect(parseGitHubRepoUrl("github.com/owner/repo")).toEqual({
        ok: true,
        value: { owner: "owner", repo: "repo" },
      });
    });
  });
});
