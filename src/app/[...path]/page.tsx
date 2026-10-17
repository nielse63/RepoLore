import { repoFromSwappedPath } from "@/lib/repo-from-swapped-path";
import { notFound, redirect } from "next/navigation";

/**
 * Catches every path no other route matches. If it's a GitHub URL with
 * `github.com` swapped for this site's host (`repolore.app/vercel/next.js`,
 * or `repolore.app/github.com/vercel/next.js`), it redirects to that
 * repository's stable Lore URL; anything else is the usual 404. A temporary
 * (307) redirect, not a cached 308, so the mapping stays reversible. Never
 * analyzes anything or calls GitHub — an unanalyzed repository's Lore page
 * offers an explicit "Analyze" button instead.
 */
export default async function SwappedGitHubPath({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const repo = repoFromSwappedPath(path);
  if (!repo) notFound();
  redirect(`/lore/${repo.owner}/${repo.repo}`);
}
