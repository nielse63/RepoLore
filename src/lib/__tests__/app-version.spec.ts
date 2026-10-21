import { execFileSync } from "node:child_process";
import { latestGitTag } from "../app-version";

jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

const mockedExecFileSync = jest.mocked(execFileSync);

describe("latestGitTag", () => {
  it("returns the nearest tag from git describe, trimmed", () => {
    mockedExecFileSync.mockReturnValue("v0.0.1\n");
    expect(latestGitTag()).toBe("v0.0.1");
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      ["describe", "--tags", "--abbrev=0"],
      expect.objectContaining({ encoding: "utf8" })
    );
  });

  it("returns undefined when git describe fails (no tags, no git)", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("fatal: No names found, cannot describe anything.");
    });
    expect(latestGitTag()).toBeUndefined();
  });

  it("returns undefined for empty output", () => {
    mockedExecFileSync.mockReturnValue("\n");
    expect(latestGitTag()).toBeUndefined();
  });
});
