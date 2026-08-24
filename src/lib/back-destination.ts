/**
 * Where the not-found page's "Back to Repo Lore" button should go: back to
 * the referring page when it was another same-origin Repo Lore page, or home
 * when the bad URL was reached directly (typed, bookmarked, or an external
 * link) — an empty or cross-origin referrer has nothing in-app to return to.
 * `history.length` isn't a reliable signal here: a freshly opened tab can
 * already report a length greater than 1 depending on how it was opened.
 */
export function resolveBackDestination(
  referrer: string,
  origin: string
): "back" | "home" {
  if (!referrer) return "home";
  try {
    return new URL(referrer).origin === origin ? "back" : "home";
  } catch {
    return "home";
  }
}
