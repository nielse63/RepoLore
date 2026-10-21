import { parsePageParam } from "@/lib/page-param";

describe("parsePageParam", () => {
  it("returns the requested page when it's in range", () => {
    expect(parsePageParam("3", 5)).toBe(3);
  });

  it("defaults to page 1 when the param is missing", () => {
    expect(parsePageParam(undefined, 5)).toBe(1);
  });

  it("defaults to page 1 when the param isn't an integer", () => {
    expect(parsePageParam("abc", 5)).toBe(1);
    expect(parsePageParam("2.5", 5)).toBe(1);
    expect(parsePageParam("", 5)).toBe(1);
  });

  it("defaults to page 1 when the param is repeated", () => {
    expect(parsePageParam(["2", "3"], 5)).toBe(1);
  });

  it("clamps a page past the end to the last page", () => {
    expect(parsePageParam("99", 5)).toBe(5);
  });

  it("clamps zero and negative pages to page 1", () => {
    expect(parsePageParam("0", 5)).toBe(1);
    expect(parsePageParam("-2", 5)).toBe(1);
  });

  it("returns page 1 when there are no pages", () => {
    expect(parsePageParam("2", 0)).toBe(1);
  });
});
