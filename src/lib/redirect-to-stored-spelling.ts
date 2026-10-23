import { findRepoIgnoringCase } from "@/db/repos";
import { permanentRedirect } from "next/navigation";

/**
 * For a `/lore/{owner}/{repo}` request with no run under that exact
 * spelling: permanently redirects to the stored spelling of the same
 * repository when one exists under different letter case (GitHub issue
 * #43), so a case-variant URL lands on the real Lore instead of a separate
 * "not analyzed" one whose Analyze button would duplicate it. DB-only — a
 * page view never calls GitHub (ADR-0017), so a rename that was never
 * submitted isn't detected here. Returns without redirecting when the
 * stored spelling is the requested one, so it can't loop.
 *
 * `subpath` (e.g. `/architecture`) is kept on the redirect target.
 */
export async function redirectToStoredSpelling(
  owner: string,
  repo: string,
  subpath = ""
): Promise<void> {
  const stored = await findRepoIgnoringCase(owner, repo);
  if (!stored || (stored.owner === owner && stored.name === repo)) return;
  permanentRedirect(`/lore/${stored.owner}/${stored.name}${subpath}`);
}
