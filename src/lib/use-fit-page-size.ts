"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN_PAGE_SIZE = 5;
// Pagination controls' own rendered height (one row of h-9 buttons, plus the
// mt-4 gap above them in GapsList) added to the page's own bottom padding
// (LorePageFrame's <main> uses py-8) — reserved so the fitted row count
// leaves that space free rather than exactly filling the viewport edge.
const RESERVED_BELOW_PX = 52 + 32;

/**
 * `<main>` (LorePageFrame) is styled `overflow-y-auto`, but its ancestor
 * chain doesn't actually bound its height in practice, so it never clips —
 * the whole document scrolls instead (confirmed: `main.clientHeight ===
 * main.scrollHeight` while `document.scrollingElement.scrollHeight` exceeds
 * `window.innerHeight`). "Without scrolling" therefore means the window's
 * viewport, not `<main>`'s own box.
 */

// useLayoutEffect warns when it runs during SSR (it never actually executes
// server-side, but Next.js still renders client components on the server
// for the initial HTML). Aliasing to useEffect there avoids the warning
// with no behavior change on the client, where this always runs.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * How many rows of a fixed-row-height list fit in the space remaining below
 * `containerRef`, inside its nearest scrollable ancestor (the page's
 * `<main>`, which is the actual scroll container — see `LorePageFrame`).
 * Measured once, synchronously after the first paint, and never
 * re-measured afterward: resizing the window won't change it, matching the
 * product decision not to track resize.
 *
 * Starts at `maxPageSize` — also the value rendered on the server, since
 * there's no viewport to measure during SSR — and only ever adjusts
 * downward from it, never above.
 */
export function useFitPageSize(
  containerRef: React.RefObject<HTMLElement | null>,
  maxPageSize: number
): number {
  const [pageSize, setPageSize] = useState(maxPageSize);
  const measured = useRef(false);

  useIsomorphicLayoutEffect(() => {
    if (measured.current) return;
    const container = containerRef.current;
    const rowCount = container?.children.length ?? 0;
    if (!container || rowCount === 0) return;
    measured.current = true;

    const rect = container.getBoundingClientRect();
    const rowHeight = rect.height / rowCount;
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) return;

    const available = window.innerHeight - rect.top - RESERVED_BELOW_PX;
    const fitCount = Math.floor(available / rowHeight);
    setPageSize(Math.min(Math.max(fitCount, MIN_PAGE_SIZE), maxPageSize));
  }, [containerRef, maxPageSize]);

  return pageSize;
}
