import type { Lore } from "@/lore/model";
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

/** Major Areas as `OverviewContent` renders them: the root `"."` area adds no orientation value. */
function majorAreaCount(lore: Lore): number {
  return lore.structuralAreas.filter((area) => area.name !== ".").length;
}

/**
 * The Overview's `<title>` when its analysis has both entry points and
 * Major Areas to show, worded the way people search for a codebase
 * ("next.js architecture", "next.js entry points") rather than just the
 * repository name. Otherwise the plain `loreRouteTitle`, so a page without
 * those sections never promises them. Callers pass `null` for a failed run
 * (even one with a persisted result), since its page renders the failure.
 */
export function loreOverviewTitle(
  owner: string,
  repo: string,
  lore: Lore | null
): string {
  return lore && lore.entryPoints.length > 0 && majorAreaCount(lore) > 0
    ? `${owner}/${repo}: codebase architecture & entry points — Repo Lore`
    : loreRouteTitle(owner, repo);
}

const DESCRIPTION_SUMMARY_MAX = 90;

function countPhrase(count: number, noun: string): string {
  if (count === 0) return `no ${noun}s`;
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The repository's GitHub description as a leading sentence, truncated, or "" if it has none. */
function leadSentence(description: string | undefined): string {
  const summary = description?.trim().replace(/[.!?]+$/, "");
  if (!summary) return "";
  if (summary.length <= DESCRIPTION_SUMMARY_MAX) return `${summary}. `;
  return `${summary.slice(0, DESCRIPTION_SUMMARY_MAX - 1).trimEnd()}… `;
}

/**
 * The Overview's meta description: the repository's own GitHub description
 * (truncated), then what this Lore actually found — the same entry point,
 * Major Area, and Start Here counts the page renders, so the snippet never
 * claims more than the page shows. Entry points are "probable" (the
 * mission's wording; each carries its own certainty label), and a partial
 * run says so, as the page's `PartialUnderstandingCard` does. Generic when
 * there's no analysis (callers pass `null` for a failed run).
 */
export function loreOverviewDescription(
  owner: string,
  repo: string,
  lore: Lore | null
): string {
  const label = `${owner}/${repo}`;
  if (!lore) {
    return `Orientation for ${label}: a Start Here reading path, major structural areas, and entry points, each backed by evidence from the analyzed source.`;
  }

  const entryPoints = countPhrase(
    lore.entryPoints.length,
    "probable entry point"
  );
  const majorAreas = countPhrase(majorAreaCount(lore), "major area");
  const found =
    lore.startHere.length > 0
      ? `${entryPoints}, ${majorAreas}, and a Start Here reading path`
      : `${entryPoints} and ${majorAreas}`;
  const intro =
    lore.snapshot.status === "completed"
      ? `How ${label} is structured`
      : `Partial analysis of how ${label} is structured`;

  return `${leadSentence(lore.snapshot.repository.description)}${intro}: ${found}, with source links and certainty labels.`;
}

/**
 * Per-route metadata for a repository Lore view: unique title/description,
 * a self-referencing canonical, and Open Graph/Twitter cards (RL-004/RL-005).
 * `noindex, follow` unless the caller passes `indexable` — only the
 * Overview route does, and only when `isIndexableLore` holds for its latest
 * run (ADR-0017). Subviews stay `noindex` so each repository
 * has one strong page in search rather than several thin ones.
 *
 * `images` is omitted for an indexable Overview so its file-based
 * `opengraph-image.tsx` (the per-repository card) is used instead of the
 * generic default.
 */
export function buildLoreMetadata({
  title,
  description,
  path,
  indexable = false,
}: {
  title: string;
  description: string;
  path: string;
  indexable?: boolean;
}): Metadata {
  const images = indexable ? undefined : [DEFAULT_OG_IMAGE];
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
      ...(images && { images }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(images && { images }),
    },
    robots: { index: indexable, follow: true },
  };
}

export { DEFAULT_OG_IMAGE };
