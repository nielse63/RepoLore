"use client";

import { MAX_PAGE_SIZE } from "@/components/lore-shell/PaginatedList";
import { PaginationNav } from "@/components/lore-shell/PaginationNav";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { useFitPageSize } from "@/lib/use-fit-page-size";
import { usePersistedPage } from "@/lib/use-persisted-page";
import { useRef } from "react";

/**
 * `PaginatedList`'s table counterpart: a Card > Table whose body rows are
 * paginated with the same fit-to-screen page size (capped at
 * `MAX_PAGE_SIZE`, see `useFitPageSize`) and a page number persisted per
 * `storageKey` (see `usePersistedPage`). Takes fully-rendered `<tr>`
 * elements, not a render prop, for the same reason `PaginatedList` does: a
 * Server Component caller can pass pre-rendered JSX across the client
 * boundary but not a function.
 */
export function PaginatedTable({
  head,
  rows,
  storageKey,
  emptyState,
}: {
  /** The `<thead>`. */
  head: React.ReactNode;
  rows: React.ReactNode[];
  storageKey: string;
  /** Rendered below the table when `rows` is empty. */
  emptyState: React.ReactNode;
}) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const pageSize = useFitPageSize(tbodyRef, MAX_PAGE_SIZE);
  const pageCount = Math.max(Math.ceil(rows.length / pageSize), 1);
  const [page, setPage] = usePersistedPage(storageKey, pageCount);
  const start = (page - 1) * pageSize;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-0">
        <Table>
          {head}
          <tbody ref={tbodyRef}>{rows.slice(start, start + pageSize)}</tbody>
        </Table>
        {rows.length === 0 && emptyState}
      </Card>

      {rows.length > pageSize && (
        <PaginationNav
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
