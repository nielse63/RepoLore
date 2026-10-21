/**
 * The page a `?page=` search param asks for, clamped to `[1, pageCount]` —
 * anything missing, repeated, non-integer, or out of range falls back to the
 * nearest valid page rather than an empty one, since the param is
 * user-editable.
 */
export function parsePageParam(
  raw: string | string[] | undefined,
  pageCount: number
): number {
  const parsed = typeof raw === "string" ? Number(raw) : NaN;
  const requested = Number.isInteger(parsed) ? parsed : 1;
  return Math.min(Math.max(requested, 1), Math.max(pageCount, 1));
}
