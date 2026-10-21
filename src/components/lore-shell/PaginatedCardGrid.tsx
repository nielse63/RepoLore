"use client";

import { PaginationNav } from "@/components/lore-shell/PaginationNav";
import { usePersistedPage } from "@/lib/use-persisted-page";

export interface PaginatedCardGridProps {
  /**
   * Fully-rendered `<Card>` elements (built by the caller, e.g. via
   * `.map()`) — not a render-prop function, since the Server Component
   * caller (Overview) can pass pre-rendered JSX across the client boundary
   * but not a function reference.
   */
  items: React.ReactNode[];
  /**
   * Fixed page size — this grid's cards are variable height and laid out in
   * two columns, so the fit-to-screen sizing `PaginatedList` uses (see
   * `useFitPageSize`) can't measure it correctly; see `MAJOR_AREAS_PAGE_SIZE`.
   */
  pageSize: number;
  /**
   * Scopes the remembered page in sessionStorage — callers should include
   * whatever this grid is specific to (e.g. a repository and a section) so
   * unrelated grids never share a saved page.
   */
  storageKey: string;
}

/**
 * Fixed-page-size pagination chrome for a responsive 2-column card grid —
 * used by Major Areas on Overview, the one paginated list in the Lore shell
 * that isn't a `Card > ul > li` list (see `PaginatedList`).
 */
export function PaginatedCardGrid({
  items,
  pageSize,
  storageKey,
}: PaginatedCardGridProps) {
  const pageCount = Math.max(Math.ceil(items.length / pageSize), 1);
  const [page, setPage] = usePersistedPage(storageKey, pageCount);

  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{pageItems}</div>

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
