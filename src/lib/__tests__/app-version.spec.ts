import { execFileSync } from "node:child_process";
import {
  appVersion,
  FALLBACK_APP_VERSION,
  latestGitTag,
  remoteGitTags,
} from "../app-version";

jest.mock("node:child_process", () => ({ execFileSync: jest.fn() }));

const mockedExecFileSync = jest.mocked(execFileSync);

const lsRemote = (...tags: string[]) =>
  tags.map((tag, i) => `${i}abc\trefs/tags/${tag}`).join("\n") + "\n";

/** Answers `git describe` and `git ls-remote` separately; `Error` throws. */
function mockGit({
  describe,
  remote,
}: {
  describe: string | Error;
  remote: string | Error;
}) {
  mockedExecFileSync.mockImplementation(((_: string, args: string[]) => {
    const result = args[0] === "describe" ? describe : remote;
    if (result instanceof Error) throw result;
    return result;
  }) as unknown as typeof execFileSync);
}

beforeEach(() => mockedExecFileSync.mockReset());

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

describe("remoteGitTags", () => {
  it("lists the public repository's tags via git ls-remote", () => {
    mockedExecFileSync.mockReturnValue(lsRemote("v0.0.1", "v0.0.2"));
    expect(remoteGitTags()).toEqual(["v0.0.1", "v0.0.2"]);
    expect(mockedExecFileSync).toHaveBeenCalledWith(
      "git",
      [
        "ls-remote",
        "--tags",
        "--refs",
        "https://github.com/nielse63/RepoLore.git",
      ],
      expect.objectContaining({ timeout: expect.any(Number) })
    );
  });

  it("returns an empty list when git or the network fails", () => {
    mockedExecFileSync.mockImplementation(() => {
      throw new Error("fatal: unable to access");
    });
    expect(remoteGitTags()).toEqual([]);
  });
});

describe("appVersion", () => {
  it("is the newest of the local and remote tags", () => {
    mockGit({ describe: "v9.0.0\n", remote: lsRemote("v9.0.1", "v8.9.9") });
    expect(appVersion()).toBe("v9.0.1");

    mockGit({ describe: "v9.1.0\n", remote: lsRemote("v9.0.1") });
    expect(appVersion()).toBe("v9.1.0");
  });

  it("uses the remote tags when the clone has none (shallow, no .git)", () => {
    mockGit({ describe: new Error("no tags"), remote: lsRemote("v9.0.0") });
    expect(appVersion()).toBe("v9.0.0");
  });

  it("falls back to the hardcoded version when git finds nothing", () => {
    mockGit({ describe: new Error("no git"), remote: new Error("offline") });
    expect(appVersion()).toBe(FALLBACK_APP_VERSION);
  });

  it("never reports a version older than the fallback", () => {
    mockGit({ describe: "v0.0.0\n", remote: lsRemote("v0.0.0", "nightly") });
    expect(appVersion()).toBe(FALLBACK_APP_VERSION);
  });
});
