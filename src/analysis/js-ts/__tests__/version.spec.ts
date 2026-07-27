import { JS_TS_ANALYZER_VERSION } from "../version";

describe("JS_TS_ANALYZER_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof JS_TS_ANALYZER_VERSION).toBe("string");
    expect(JS_TS_ANALYZER_VERSION.length).toBeGreaterThan(0);
  });
});
