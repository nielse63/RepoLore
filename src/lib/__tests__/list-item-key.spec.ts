import { listItemKey } from "../list-item-key";

describe("listItemKey", () => {
  it("appends a random alphanumeric suffix to the index", () => {
    expect(listItemKey(0)).toMatch(/^0-[a-z0-9]+$/);
    expect(listItemKey(5)).toMatch(/^5-[a-z0-9]+$/);
  });

  it("returns the same key for the same index across calls", () => {
    expect(listItemKey(3)).toBe(listItemKey(3));
  });

  it("returns distinct keys for distinct indices", () => {
    const keys = Array.from({ length: 50 }, (_, i) => listItemKey(i));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
