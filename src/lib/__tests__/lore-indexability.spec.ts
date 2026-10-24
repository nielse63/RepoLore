import type { AnalysisRunRow } from "@/db/analysis-runs";
import {
  indexabilityFactsFromRun,
  isIndexableLore,
  type LoreIndexabilityFacts,
} from "../lore-indexability";

const indexable: LoreIndexabilityFacts = {
  owner: "acme",
  repo: "widgets",
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

  it.each([
    ["nielse63", "repo-lore-ts-react-app-fixture"],
    ["nielse63", "repo-lore-python-app-fixture"],
    ["Nielse63", "Repo-Lore-TS-Library-Fixture"],
  ])(
    "rejects Repo Lore's own test fixture %s/%s (issue #44)",
    (owner, repo) => {
      expect(isIndexableLore({ ...indexable, owner, repo })).toBe(false);
    }
  );

  it.each([
    ["nielse63", "RepoLore"],
    ["acme", "repo-lore-ts-react-app-fixture"],
    ["nielse63", "repo-lore-fixture"],
    ["nielse63", "my-repo-lore-app-fixture"],
  ])("still accepts %s/%s, which isn't a Repo Lore fixture", (owner, repo) => {
    expect(isIndexableLore({ ...indexable, owner, repo })).toBe(true);
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

  it("projects a run's repository, status, counts (excluding the root area), and visibility", () => {
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
        snapshot: {
          repository: { owner: "acme", name: "widgets", isPrivate: false },
        },
      },
    } as unknown as AnalysisRunRow;
    expect(indexabilityFactsFromRun(run)).toEqual(indexable);
  });
});
