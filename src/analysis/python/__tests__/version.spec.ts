import { PYTHON_ANALYZER_VERSION } from "../version";

describe("PYTHON_ANALYZER_VERSION", () => {
  it("is a non-empty string", () => {
    expect(typeof PYTHON_ANALYZER_VERSION).toBe("string");
    expect(PYTHON_ANALYZER_VERSION.length).toBeGreaterThan(0);
  });
});
