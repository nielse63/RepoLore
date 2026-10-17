import type { LatestRunIndexabilityRow } from "@/db/analysis-runs";
import { isIndexableLore } from "@/lib/lore-indexability";

/**
 * Well-known repositories (all in `scripts/seed-repos.txt`) the home page
 * shows first as example Lores, in this order — recognizable names make a
 * better first impression than whatever was submitted most recently.
 */
export const FEATURED_REPOS = [
  "facebook/react",
  "vercel/next.js",
  "shadcn-ui/ui",
  "excalidraw/excalidraw",
  "axios/axios",
  "tailwindlabs/tailwindcss",
] as const;

const slug = (row: LatestRunIndexabilityRow) =>
  `${row.owner}/${row.repo}`.toLowerCase();

/**
 * Only Lores `isIndexableLore` accepts — the same rule the sitemap and each
 * Overview's `robots` tag use, so nothing linked publicly is a thin page —
 * sorted by `owner/repo`.
 */
export function indexableLores(
  rows: LatestRunIndexabilityRow[]
): LatestRunIndexabilityRow[] {
  return rows
    .filter(isIndexableLore)
    .sort((a, b) => slug(a).localeCompare(slug(b)));
}

/**
 * Up to `limit` indexable Lores for the home page: `FEATURED_REPOS` that
 * have one, in that order, then the most recently analyzed others to fill
 * any gap (e.g. before production has been seeded).
 */
export function selectFeaturedLores(
  rows: LatestRunIndexabilityRow[],
  limit = 6
): LatestRunIndexabilityRow[] {
  const candidates = rows.filter(isIndexableLore);
  const featuredOrder = FEATURED_REPOS.map((repo) => repo.toLowerCase());
  const featured = featuredOrder.flatMap((wanted) =>
    candidates.filter((row) => slug(row) === wanted)
  );
  const rest = candidates
    .filter((row) => !featuredOrder.includes(slug(row)))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return [...featured, ...rest].slice(0, limit);
}
