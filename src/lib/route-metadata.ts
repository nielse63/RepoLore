import type { Metadata } from "next";
import { headers } from "next/headers";

const DEFAULT_OG_IMAGE = "/web-app-manifest-512x512.png";

/**
 * The deployed origin isn't a fixed, decided value yet (no custom domain —
 * `render.yaml` has no domain config, and the current host is Render's
 * auto-generated subdomain) — reversibility (ADR principle) favors deriving
 * it from the incoming request over hardcoding a hostname that's likely to
 * change. `NEXT_PUBLIC_SITE_URL` lets a future fixed domain override this
 * without another code change.
 */
async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function siteMetadataBase(): Promise<URL> {
  return new URL(await siteOrigin());
}

/** `{owner}/{repo} {view} — Repo Lore`, or `{owner}/{repo} — Repo Lore` for the Overview route. */
export function loreRouteTitle(
  owner: string,
  repo: string,
  view?: string
): string {
  const repoLabel = `${owner}/${repo}`;
  return view ? `${repoLabel} ${view} — Repo Lore` : `${repoLabel} — Repo Lore`;
}

/**
 * Per-route metadata for a repository Lore view: unique title/description,
 * a self-referencing canonical, and Open Graph/Twitter cards (RL-004/RL-005).
 * Repository views show data from a specific analysis run rather than
 * evergreen content, and this app has no established indexing intent yet, so
 * they're marked `noindex, follow` explicitly rather than left ambiguous.
 */
export function buildLoreMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Repo Lore",
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
    robots: { index: false, follow: true },
  };
}

export { DEFAULT_OG_IMAGE };
