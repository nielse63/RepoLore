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
    majorAreaCount: 4,
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
      row("nielse63/repo-lore-ts-react-app-fixture"),
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
      row("shadcn-ui/ui"),
      row("acme/new", { createdAt: new Date("2026-10-10T00:00:00Z") }),
      row("SvelteJS/Svelte"),
    ];
    expect(slugs(selectFeaturedLores(rows))).toEqual([
      "SvelteJS/Svelte",
      "shadcn-ui/ui",
      "acme/new",
      "acme/old",
    ]);
  });

  it("skips featured repositories whose Lore isn't indexable", () => {
    const rows = [
      row("sveltejs/svelte", { runStatus: "partial" }),
      row("react/react"),
    ];
    expect(slugs(selectFeaturedLores(rows))).toEqual(["react/react"]);
  });

  it("features React under GitHub's canonical react/react, not its pre-rename facebook/react (issue #43)", () => {
    const rows = [
      row("facebook/react", { createdAt: new Date("2026-10-10T00:00:00Z") }),
      row("acme/newer", { createdAt: new Date("2026-10-09T00:00:00Z") }),
      row("react/react", { createdAt: new Date("2026-01-01T00:00:00Z") }),
    ];
    expect(slugs(selectFeaturedLores(rows))).toEqual([
      "react/react",
      "facebook/react",
      "acme/newer",
    ]);
  });

  it("never fills the gap with Repo Lore's own test fixtures (issue #44)", () => {
    const rows = [
      row("nielse63/repo-lore-ts-library-fixture", {
        createdAt: new Date("2026-10-10T00:00:00Z"),
      }),
      row("acme/app"),
    ];
    expect(slugs(selectFeaturedLores(rows))).toEqual(["acme/app"]);
  });

  it("returns at most `limit` Lores", () => {
    const rows = ["a/1", "a/2", "a/3", "a/4"].map((s) => row(s));
    expect(selectFeaturedLores(rows, 2)).toHaveLength(2);
  });
});
