import { cn } from "../cn";

describe("cn", () => {
  it("joins truthy string fragments with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b");
  });

  it("filters out empty strings and zero", () => {
    expect(cn("a", "", 0, "b")).toBe("a b");
  });

  it("returns an empty string when given no truthy values", () => {
    expect(cn(null, undefined, false)).toBe("");
  });

  it("returns an empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("coerces numeric class fragments via join", () => {
    expect(cn("a", 1, "b")).toBe("a 1 b");
  });
});
