import { formatPath } from "../format-path";

describe("formatPath", () => {
  it("adds a leading slash to a relative path", () => {
    expect(formatPath("src/index.ts")).toBe("/src/index.ts");
  });

  it("adds a leading slash to a single-segment path", () => {
    expect(formatPath("index.ts")).toBe("/index.ts");
  });

  it("leaves an already-prefixed path unchanged", () => {
    expect(formatPath("/src/index.ts")).toBe("/src/index.ts");
  });

  it('renders the root directory sentinel "." as "/"', () => {
    expect(formatPath(".")).toBe("/");
  });
});
