import { HomeContent } from "@/components/HomeContent";
import { listLatestRunIndexabilityFacts } from "@/db/analysis-runs";
import { selectFeaturedLores } from "@/lib/featured-lores";
import type { Metadata } from "next";

/**
 * Read from the database per request, like `sitemap.ts`, so `npm run build`
 * needs no `DATABASE_URL` and newly indexable Lores appear without a
 * redeploy.
 */
export const dynamic = "force-dynamic";

/**
 * Only the home page's canonical lives here rather than on the root layout:
 * a layout-level `alternates.canonical` is inherited by every child route
 * that doesn't declare its own, which wrongly pointed every such route
 * (including 404s) at the home page.
 * Title/description/Open Graph/Twitter stay on the root layout
 * since those are reasonable shared defaults for routes with no metadata of
 * their own.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * A database error hides the example Lores rather than failing the page —
 * the submission form is the page's job and needs no database to render.
 */
export default async function Home() {
  let featuredLores: Awaited<ReturnType<typeof selectFeaturedLores>> = [];
  try {
    featuredLores = selectFeaturedLores(await listLatestRunIndexabilityFacts());
  } catch (error) {
    console.error("home: failed to list example Lores:", error);
  }
  return <HomeContent featuredLores={featuredLores} />;
}
