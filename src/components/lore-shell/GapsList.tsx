"use client";

import { PaginatedList } from "@/components/lore-shell/PaginatedList";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import type { Gap } from "@/lore/model";

export interface GapsListProps {
  gaps: Gap[];
  /**
   * Scopes the remembered page in sessionStorage — callers should include
   * whatever this list is specific to (e.g. a repository and a section) so
   * unrelated lists never share a saved page.
   */
  storageKey: string;
}

/** Paginated gaps list, shared by the Overview and Architecture pages. */
export function GapsList({ gaps, storageKey }: GapsListProps) {
  if (gaps.length === 0) {
    return <p className="text-sm text-muted">None.</p>;
  }

  return (
    <PaginatedList
      items={gaps.map((gap, i) => (
        <li key={i} className="flex items-start gap-2 px-6 py-3 text-sm">
          <CertaintyBadge certainty={gap.certainty} />
          <span className="text-foreground">{gap.description}</span>
        </li>
      ))}
      storageKey={storageKey}
      emptyState={null}
    />
  );
}
