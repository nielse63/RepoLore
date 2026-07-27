import { githubBlobUrl, githubTreeUrl } from "../urls";
import type { SourceLocation } from "@/lore/model";

describe("githubBlobUrl", () => {
  it("builds a blob URL without a line anchor when startLine is absent", () => {
    const location: SourceLocation = { filePath: "src/index.ts" };
    expect(githubBlobUrl("owner", "repo", "abc123", location)).toBe(
      "https://github.com/owner/repo/blob/abc123/src/index.ts"
    );
  });

  it("appends a #L{line} anchor when startLine is present", () => {
    const location: SourceLocation = {
      filePath: "src/index.ts",
      startLine: 42,
    };
    expect(githubBlobUrl("owner", "repo", "abc123", location)).toBe(
      "https://github.com/owner/repo/blob/abc123/src/index.ts#L42"
    );
  });
});

describe("githubTreeUrl", () => {
  it("builds a tree URL for a nested directory", () => {
    const location: SourceLocation = { filePath: "src/analysis" };
    expect(githubTreeUrl("owner", "repo", "abc123", location)).toBe(
      "https://github.com/owner/repo/tree/abc123/src/analysis"
    );
  });

  it('omits the path segment for the project root ("." )', () => {
    const location: SourceLocation = { filePath: "." };
    expect(githubTreeUrl("owner", "repo", "abc123", location)).toBe(
      "https://github.com/owner/repo/tree/abc123"
    );
  });
});
