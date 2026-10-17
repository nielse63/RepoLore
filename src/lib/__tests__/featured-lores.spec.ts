import type { LatestRunIndexabilityRow } from "@/db/analysis-runs";
import { indexableLores, selectFeaturedLores } from "../featured-lores";

function row(
  slug: string,
  overrides: Partial<LatestRunIndexabilityRow> = {}
): LatestRunIndexabilityRow {
  const [owner, repo] = slug.split("/");
  return {
    owner,
    repo,
    description: null,
    runStatus: "completed",
    entryPointCount: 3,
    structuralAreaCount: 4,
    isPrivate: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

const slugs = (rows: LatestRunIndexabilityRow[]) =>
  rows.map((r) => `${r.owner}/${r.repo}`);

describe("indexableLores", () => {
  it("keeps only indexable Lores, sorted by owner/repo", () => {
    const rows = [
      row("zeta/app"),
      row("acme/failed", { runStatus: "failed" }),
      row("Beta/lib"),
      row("acme/empty", { entryPointCount: 0 }),
      row("acme/widgets"),
    ];
    expect(slugs(indexableLores(rows))).toEqual([
      "acme/widgets",
      "Beta/lib",
      "zeta/app",
    ]);
  });
});

describe("selectFeaturedLores", () => {
  it("puts featured repositories first, in featured order, then the most recent others", () => {
    const rows = [
      row("acme/old", { createdAt: new Date("2026-01-01T00:00:00Z") }),
      row("fastapi/fastapi"),
      row("acme/new", { createdAt: new Date("2026-10-10T00:00:00Z") }),
      row("Vercel/Next.js"),
    ];
    expect(slugs(selectFeaturedLores(rows))).toEqual([
      "Vercel/Next.js",
      "fastapi/fastapi",
      "acme/new",
      "acme/old",
    ]);
  });

  it("skips featured repositories whose Lore isn't indexable", () => {
    const rows = [
      row("vercel/next.js", { runStatus: "partial" }),
      row("facebook/react"),
    ];
    expect(slugs(selectFeaturedLores(rows))).toEqual(["facebook/react"]);
  });

  it("returns at most `limit` Lores", () => {
    const rows = ["a/1", "a/2", "a/3", "a/4"].map((s) => row(s));
    expect(selectFeaturedLores(rows, 2)).toHaveLength(2);
  });
});
