"use client";

import { Card } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/Pagination";
import { getPageItems } from "@/lib/pagination-range";
import { usePersistedPage } from "@/lib/use-persisted-page";
import type { Gap } from "@/lore/model";

const PAGE_SIZE = 25;

export interface GapsListProps {
  gaps: Gap[];
  /**
   * Scopes the remembered page in sessionStorage — callers should include
   * whatever this list is specific to (e.g. a repository and a section) so
   * unrelated lists never share a saved page.
   */
  storageKey: string;
}

/** Paginated gaps list (25 per page), shared by the Overview and Architecture pages. */
export function GapsList({ gaps, storageKey }: GapsListProps) {
  const pageCount = Math.max(Math.ceil(gaps.length / PAGE_SIZE), 1);
  const [page, setPage] = usePersistedPage(storageKey, pageCount);

  if (gaps.length === 0) {
    return <p className="text-sm text-muted">None.</p>;
  }

  const start = (page - 1) * PAGE_SIZE;
  const pageGaps = gaps.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <ul className="divide-y divide-border">
          {pageGaps.map((gap, i) => (
            <li
              key={start + i}
              className="flex items-start gap-2 px-6 py-3 text-sm"
            >
              <CertaintyBadge certainty={gap.certainty} />
              <span className="text-foreground">{gap.description}</span>
            </li>
          ))}
        </ul>
      </Card>

      {gaps.length > PAGE_SIZE && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              />
            </PaginationItem>
            {getPageItems(page, pageCount).map((item, i) =>
              item === "ellipsis-start" || item === "ellipsis-end" ? (
                <PaginationItem key={`${item}-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    isActive={item === page}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}
            <PaginationItem>
              <PaginationNext
                disabled={page === pageCount}
                onClick={() => setPage(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
