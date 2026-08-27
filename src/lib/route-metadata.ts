import type { Metadata } from "next";

const DEFAULT_OG_IMAGE = "/web-app-manifest-512x512.png";
const FALLBACK_ORIGIN = "http://localhost:3000";

/**
 * The deployed origin isn't a fixed, decided value yet (no custom domain —
 * `render.yaml` has no domain config). Deriving it from the incoming
 * request's `Host` header was tried and reverted: `Host` is
 * attacker-controllable, which would let a forged/proxied request poison the
 * canonical/OG URLs on the one route that isn't `noindex`, and reading a
 * request header here forces every route in the app out of static
 * rendering. `RENDER_EXTERNAL_URL` is set automatically by Render to the
 * current deployment's origin; `NEXT_PUBLIC_SITE_URL` lets a future fixed
 * domain override it explicitly.
 */
function siteOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!configured) return FALLBACK_ORIGIN;
  return /^https?:\/\//.test(configured) ? configured : `https://${configured}`;
}

export function siteMetadataBase(): URL {
  try {
    return new URL(siteOrigin());
  } catch {
    return new URL(FALLBACK_ORIGIN);
  }
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
