"use client";

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

export interface PaginationNavProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Previous/page-numbers/Next controls shared by every paginated list in the
 * Lore shell (Entry Points, Gaps, Test Relationships, Dependencies, Major
 * Areas) — callers are responsible for only rendering this once there's more
 * than one page.
 */
export function PaginationNav({
  page,
  pageCount,
  onPageChange,
  className,
}: PaginationNavProps) {
  return (
    <Pagination className={className}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
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
                onClick={() => onPageChange(item)}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <PaginationNext
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
