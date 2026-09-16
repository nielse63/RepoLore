export type PageItem = number | "ellipsis-start" | "ellipsis-end";

/**
 * Windowed page-number sequence for pagination controls: always includes the
 * first and last page, the current page, `siblingCount` pages on either side
 * of it, and an ellipsis marker wherever that leaves a gap — so the control
 * stays a small, fixed width regardless of how many pages exist.
 */
export function getPageItems(
  page: number,
  pageCount: number,
  siblingCount = 1
): PageItem[] {
  if (pageCount <= 0) return [];
  if (pageCount === 1) return [1];

  const totalVisible = siblingCount * 2 + 5;
  if (pageCount <= totalVisible) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, pageCount);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < pageCount - 1;

  const items: PageItem[] = [1];
  if (showLeftEllipsis) items.push("ellipsis-start");
  for (let p = leftSibling; p <= rightSibling; p++) {
    if (p !== 1 && p !== pageCount) items.push(p);
  }
  if (showRightEllipsis) items.push("ellipsis-end");
  items.push(pageCount);
  return items;
}
