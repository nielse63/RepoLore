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
 * rendering. `RENDER_EXTERNAL_URL` is set automatically by Render, but only
 * at runtime, not during `npm run build` — since `/` is statically
 * prerendered, that var can't be relied on here. `NEXT_PUBLIC_SITE_URL`
 * (declared in `render.yaml` so it's present during the build) is the
 * source of truth; `RENDER_EXTERNAL_URL` is kept only as a runtime fallback
 * for routes that aren't statically prerendered.
 *
 * Warns rather than throws when unconfigured in production: `next build`
 * always runs with `NODE_ENV=production`, including a contributor's local
 * `npm run build` with no `NEXT_PUBLIC_SITE_URL` set, so throwing here would
 * break that documented workflow, not just catch a real misconfigured
 * deploy. A warning still makes Render's build/deploy logs say so plainly,
 * rather than shipping http://localhost:3000 canonical/OG URLs silently.
 */
function siteOrigin(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "No NEXT_PUBLIC_SITE_URL is configured. Set it in the Render dashboard (see .env.example) — canonical/Open Graph/Twitter URLs will fall back to http://localhost:3000."
      );
    }
    return FALLBACK_ORIGIN;
  }
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
