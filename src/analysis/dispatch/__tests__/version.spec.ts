import { JS_TS_ANALYZER_VERSION } from "@/analysis/js-ts/version";
import { PYTHON_ANALYZER_VERSION } from "@/analysis/python/version";
import { DISPATCH_VERSION, buildAnalyzerVersion } from "../version";

describe("buildAnalyzerVersion", () => {
  it("composes a single-analyzer version", () => {
    expect(buildAnalyzerVersion(["python"])).toBe(
      `${DISPATCH_VERSION}:${PYTHON_ANALYZER_VERSION}`
    );
  });

  it("composes a multi-analyzer version, sorted deterministically regardless of input order", () => {
    expect(buildAnalyzerVersion(["python", "js-ts"])).toBe(
      buildAnalyzerVersion(["js-ts", "python"])
    );
    expect(buildAnalyzerVersion(["js-ts", "python"])).toBe(
      `${DISPATCH_VERSION}:${JS_TS_ANALYZER_VERSION}+${PYTHON_ANALYZER_VERSION}`
    );
  });

  it("marks an empty selection as unsupported", () => {
    expect(buildAnalyzerVersion([])).toBe(`${DISPATCH_VERSION}:unsupported`);
  });
});
