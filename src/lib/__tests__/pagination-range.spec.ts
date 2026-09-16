import { getPageItems } from "@/lib/pagination-range";

describe("getPageItems", () => {
  it("returns an empty array when there are no pages", () => {
    expect(getPageItems(1, 0)).toEqual([]);
  });

  it("returns a single page for pageCount 1", () => {
    expect(getPageItems(1, 1)).toEqual([1]);
  });

  it("returns every page when the total fits without an ellipsis", () => {
    expect(getPageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shows only a right ellipsis when the current page is near the start", () => {
    expect(getPageItems(1, 20)).toEqual([1, 2, "ellipsis-end", 20]);
  });

  it("shows only a left ellipsis when the current page is near the end", () => {
    expect(getPageItems(20, 20)).toEqual([1, "ellipsis-start", 19, 20]);
  });

  it("shows both ellipses when the current page is in the middle", () => {
    expect(getPageItems(10, 20)).toEqual([
      1,
      "ellipsis-start",
      9,
      10,
      11,
      "ellipsis-end",
      20,
    ]);
  });

  it("respects a wider siblingCount", () => {
    expect(getPageItems(10, 20, 2)).toEqual([
      1,
      "ellipsis-start",
      8,
      9,
      10,
      11,
      12,
      "ellipsis-end",
      20,
    ]);
  });
});
