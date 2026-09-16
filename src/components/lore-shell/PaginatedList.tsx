"use client";

import { Card } from "@/components/ui/Card";
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
import { useRef } from "react";

export const MAX_PAGE_SIZE = 15;

export interface PaginatedListProps {
  /**
   * Fully-rendered `<li>` elements (built by the caller, e.g. via `.map()`)
   * — not a render-prop function, since a Server Component caller (Overview,
   * Architecture) can pass pre-rendered JSX across the client boundary but
   * not a function reference.
   */
  items: React.ReactNode[];
  /**
   * Scopes the remembered page in sessionStorage — callers should include
   * whatever this list is specific to (e.g. a repository and a section) so
   * unrelated lists never share a saved page.
   */
  storageKey: string;
  /** Rendered as the sole row when `items` is empty. */
  emptyState: React.ReactNode;
}

/**
 * Shared pagination chrome for the simple Card > ul > li lists across the
 * Lore pages (Gaps, Entry Points, Test Relationships): a page size that
 * fits the screen at load (capped at 15 — see `useFitPageSize`), a page
 * number persisted per `storageKey` (see `usePersistedPage`), and controls
 * that only appear once there's more than one page.
 */
export function PaginatedList({
  items,
  storageKey,
  emptyState,
}: PaginatedListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const pageSize = useFitPageSize(listRef, MAX_PAGE_SIZE);
  const pageCount = Math.max(Math.ceil(items.length / pageSize), 1);
  const [page, setPage] = usePersistedPage(storageKey, pageCount);

  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <ul ref={listRef} className="divide-y divide-border">
          {items.length === 0 ? emptyState : pageItems}
        </ul>
      </Card>

      {items.length > pageSize && (
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
