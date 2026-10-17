import type { AnalysisRunRow } from "@/db/analysis-runs";
import {
  indexabilityFactsFromRun,
  isIndexableLore,
  type LoreIndexabilityFacts,
} from "../lore-indexability";

const indexable: LoreIndexabilityFacts = {
  runStatus: "completed",
  entryPointCount: 2,
  majorAreaCount: 3,
  isPrivate: false,
};

describe("isIndexableLore", () => {
  it("accepts a completed run with entry points and structural areas", () => {
    expect(isIndexableLore(indexable)).toBe(true);
  });

  it("rejects a missing run", () => {
    expect(isIndexableLore(null)).toBe(false);
  });

  it.each(["partial", "failed"] as const)("rejects a %s run", (runStatus) => {
    expect(isIndexableLore({ ...indexable, runStatus })).toBe(false);
  });

  it("rejects a run with no entry points", () => {
    expect(isIndexableLore({ ...indexable, entryPointCount: 0 })).toBe(false);
  });

  it("rejects a run with no Major Areas", () => {
    expect(isIndexableLore({ ...indexable, majorAreaCount: 0 })).toBe(false);
  });

  it("rejects a private repository", () => {
    expect(isIndexableLore({ ...indexable, isPrivate: true })).toBe(false);
  });
});

describe("indexabilityFactsFromRun", () => {
  it("returns null for a missing run or one with no result", () => {
    expect(indexabilityFactsFromRun(null)).toBeNull();
    expect(
      indexabilityFactsFromRun({
        status: "failed",
        result: null,
      } as AnalysisRunRow)
    ).toBeNull();
  });

  it("projects a run's status, counts (excluding the root area), and visibility", () => {
    const run = {
      status: "completed",
      result: {
        entryPoints: [{}, {}],
        structuralAreas: [
          { name: "src" },
          { name: "lib" },
          { name: "." },
          { name: "test" },
        ],
        snapshot: { repository: { isPrivate: false } },
      },
    } as unknown as AnalysisRunRow;
    expect(indexabilityFactsFromRun(run)).toEqual(indexable);
  });
});
