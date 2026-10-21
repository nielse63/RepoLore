"use client";

import { PaginationNav } from "@/components/lore-shell/PaginationNav";
import { Card } from "@/components/ui/Card";
import { useFitPageSize } from "@/lib/use-fit-page-size";
import { usePersistedPage } from "@/lib/use-persisted-page";
import { useRef } from "react";

export const MAX_PAGE_SIZE = 15;
/**
 * Fixed page size for Major Areas (Overview, Architecture, Systems) — unlike
 * the other paginated lists, Major Areas paginates at a fixed threshold
 * rather than however many rows fit the screen, since Overview renders it as
 * a 2-column grid of variable-height cards that fit-to-screen measurement
 * (see `useFitPageSize`) can't size correctly.
 */
export const MAJOR_AREAS_PAGE_SIZE = 6;

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
  /**
   * Overrides the default fit-to-screen sizing (see `useFitPageSize`) with a
   * fixed page size — for lists like Major Areas that should paginate at a
   * fixed threshold regardless of viewport.
   */
  pageSize?: number;
}

/**
 * Shared pagination chrome for the simple Card > ul > li lists across the
 * Lore pages (Gaps, Entry Points, Test Relationships, Major Areas): a page
 * size that by default fits the screen at load (capped at 15 — see
 * `useFitPageSize`), or a fixed size when `pageSize` is given; a page number
 * persisted per `storageKey` (see `usePersistedPage`); and controls that
 * only appear once there's more than one page.
 */
export function PaginatedList({
  items,
  storageKey,
  emptyState,
  pageSize: fixedPageSize,
}: PaginatedListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const fitPageSize = useFitPageSize(listRef, MAX_PAGE_SIZE);
  const pageSize = fixedPageSize ?? fitPageSize;
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
        <PaginationNav
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
