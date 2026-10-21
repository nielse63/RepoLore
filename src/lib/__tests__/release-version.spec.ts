import {
  bumpVersion,
  latestVersion,
  nextTag,
  parseVersion,
} from "../release-version";

describe("parseVersion", () => {
  it("accepts versions with or without a v prefix", () => {
    expect(parseVersion("1.2.3")).toEqual([1, 2, 3]);
    expect(parseVersion("v10.0.12")).toEqual([10, 0, 12]);
  });

  it("rejects anything that isn't plain X.Y.Z", () => {
    expect(parseVersion("1.2")).toBeUndefined();
    expect(parseVersion("v1.2.3-beta.1")).toBeUndefined();
    expect(parseVersion("release-1")).toBeUndefined();
  });
});

describe("latestVersion", () => {
  it("picks the highest semver numerically, ignoring other tags", () => {
    expect(latestVersion(["v0.0.9", "v0.0.10", "nightly", "v0.0.2"])).toEqual([
      0, 0, 10,
    ]);
  });

  it("returns undefined when there are no semver tags", () => {
    expect(latestVersion([])).toBeUndefined();
    expect(latestVersion(["nightly"])).toBeUndefined();
  });
});

describe("bumpVersion", () => {
  it("bumps one component and resets the lower ones", () => {
    expect(bumpVersion([1, 2, 3], "major")).toEqual([2, 0, 0]);
    expect(bumpVersion([1, 2, 3], "minor")).toEqual([1, 3, 0]);
    expect(bumpVersion([1, 2, 3], "patch")).toEqual([1, 2, 4]);
  });
});

describe("nextTag", () => {
  it("bumps the latest tag", () => {
    expect(nextTag([0, 0, 1], { bump: "patch" })).toBe("v0.0.2");
  });

  it("bumps from v0.0.0 when there is no prior tag", () => {
    expect(nextTag(undefined, { bump: "minor" })).toBe("v0.1.0");
  });

  it("accepts an explicit newer version, normalizing the v prefix", () => {
    expect(nextTag([0, 0, 1], { version: "1.0.0" })).toBe("v1.0.0");
    expect(nextTag(undefined, { version: "v0.5.0" })).toBe("v0.5.0");
  });

  it("rejects an explicit version that isn't newer than the latest", () => {
    expect(() => nextTag([0, 2, 0], { version: "0.2.0" })).toThrow(
      "v0.2.0 is not newer than the latest tag v0.2.0"
    );
    expect(() => nextTag([0, 2, 0], { version: "0.1.9" })).toThrow(/not newer/);
  });

  it("rejects a malformed explicit version", () => {
    expect(() => nextTag([0, 0, 1], { version: "next" })).toThrow(
      /not a version/
    );
  });
});
