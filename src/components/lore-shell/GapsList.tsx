"use client";

import { useRef } from "react";
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
import { useFitPageSize } from "@/lib/use-fit-page-size";
import { usePersistedPage } from "@/lib/use-persisted-page";
import type { Gap } from "@/lore/model";

const MAX_PAGE_SIZE = 25;

export interface GapsListProps {
  gaps: Gap[];
  /**
   * Scopes the remembered page in sessionStorage — callers should include
   * whatever this list is specific to (e.g. a repository and a section) so
   * unrelated lists never share a saved page.
   */
  storageKey: string;
}

/**
 * Paginated gaps list, shared by the Overview and Architecture pages. The
 * page size defaults to (and never exceeds) 25, but shrinks once, right
 * after load, to however many rows actually fit on screen without
 * scrolling — see `useFitPageSize`.
 */
export function GapsList({ gaps, storageKey }: GapsListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const pageSize = useFitPageSize(listRef, MAX_PAGE_SIZE);
  const pageCount = Math.max(Math.ceil(gaps.length / pageSize), 1);
  const [page, setPage] = usePersistedPage(storageKey, pageCount);

  if (gaps.length === 0) {
    return <p className="text-sm text-muted">None.</p>;
  }

  const start = (page - 1) * pageSize;
  const pageGaps = gaps.slice(start, start + pageSize);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <ul ref={listRef} className="divide-y divide-border">
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

      {gaps.length > pageSize && (
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
