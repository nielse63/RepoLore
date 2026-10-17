import type { AnalysisRunRow } from "@/db/analysis-runs";
import { majorAreasOf } from "@/lore/major-areas";

/**
 * The minimal facts the indexing rule needs — small enough for the sitemap
 * to select in SQL without loading every run's full `result` JSONB, so the
 * page's `robots` tag, `sitemap.ts`, and the Open Graph image all share this
 * one rule rather than each re-deriving it.
 */
export interface LoreIndexabilityFacts {
  runStatus: AnalysisRunRow["status"];
  entryPointCount: number;
  /** Major Areas (`majorAreasOf`), as the Overview lists them. */
  majorAreaCount: number;
  isPrivate: boolean;
}

export function indexabilityFactsFromRun(
  run: AnalysisRunRow | null
): LoreIndexabilityFacts | null {
  if (!run?.result) return null;
  return {
    runStatus: run.status,
    entryPointCount: run.result.entryPoints.length,
    majorAreaCount: majorAreasOf(run.result.structuralAreas).length,
    isPrivate: run.result.snapshot.repository.isPrivate,
  };
}

/**
 * Whether a repository's Overview is worth listing in search
 * (ADR-0017): its latest run — the one the page actually
 * renders — fully completed and found at least one entry point and one
 * Major Area (the root `"."` area alone leaves the Overview's Major Areas
 * section empty, so it doesn't count). A `'partial'` run is excluded because its gaps are
 * material to what it shows, and a `'failed'` or empty run would be a thin
 * page. Private repositories are rejected at submission already; checked
 * here too so one can never be advertised by the sitemap.
 */
export function isIndexableLore(facts: LoreIndexabilityFacts | null): boolean {
  return (
    facts !== null &&
    facts.runStatus === "completed" &&
    !facts.isPrivate &&
    facts.entryPointCount > 0 &&
    facts.majorAreaCount > 0
  );
}
