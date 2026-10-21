"use client";

import { PaginationNav } from "@/components/lore-shell/PaginationNav";
import { useRouter } from "next/navigation";

export interface PaginatedCardGridProps {
  /**
   * Fully-rendered `<Card>` elements for the current page only (built by
   * the caller, e.g. via `.map()`) — not a render-prop function, since the
   * Server Component caller (Overview) can pass pre-rendered JSX across the
   * client boundary but not a function reference. Only the current page is
   * passed, not every item, because a large repository can have thousands
   * of Major Areas and serializing every card into the page payload made
   * its Overview take tens of seconds to render.
   */
  items: React.ReactNode[];
  /** Current page (1-based), already clamped by the caller (`parsePageParam`). */
  page: number;
  pageCount: number;
}

/**
 * Pagination chrome for a responsive 2-column card grid — used by Major
 * Areas on Overview, the one paginated list in the Lore shell that isn't a
 * `Card > ul > li` list (see `PaginatedList`). The page lives in the URL
 * (`?page=N`, omitted for page 1) rather than in sessionStorage like
 * `usePersistedPage`, so the server renders only that page's cards;
 * changing page is a navigation that re-renders the route with the new
 * `page`, keeping the scroll position.
 */
export function PaginatedCardGrid({
  items,
  page,
  pageCount,
}: PaginatedCardGridProps) {
  const router = useRouter();

  const goToPage = (next: number) => {
    const { pathname } = window.location;
    router.push(next === 1 ? pathname : `${pathname}?page=${next}`, {
      scroll: false,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{items}</div>

      {pageCount > 1 && (
        <PaginationNav
          page={page}
          pageCount={pageCount}
          onPageChange={goToPage}
        />
      )}
    </div>
  );
}
