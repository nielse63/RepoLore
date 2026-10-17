import type { LatestRunIndexabilityRow } from "@/db/analysis-runs";
import Link from "next/link";

/**
 * A link to one repository's Lore, as listed on `/explore` and the home
 * page's example Lores. The counts are the same two facts that made it
 * indexable (`isIndexableLore`).
 */
export function LoreCard({ lore }: { lore: LatestRunIndexabilityRow }) {
  const { owner, repo, description, entryPointCount, majorAreaCount } = lore;
  return (
    <li>
      <Link
        href={`/lore/${owner}/${repo}`}
        className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="font-mono text-sm font-semibold text-foreground">
          {owner}/{repo}
        </span>
        {description && (
          <span className="mt-2 line-clamp-2 text-sm text-muted">
            {description}
          </span>
        )}
        <span className="mt-auto pt-3 text-xs text-muted">
          {entryPointCount} entry {entryPointCount === 1 ? "point" : "points"} ·{" "}
          {majorAreaCount} {majorAreaCount === 1 ? "major area" : "major areas"}
        </span>
      </Link>
    </li>
  );
}
