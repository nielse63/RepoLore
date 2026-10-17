import { listLatestRunIndexabilityFacts } from "@/db/analysis-runs";
import { isIndexableLore } from "@/lib/lore-indexability";
import { siteMetadataBase } from "@/lib/route-metadata";
import type { MetadataRoute } from "next";

/**
 * Read from the database per request rather than at build time, so `npm
 * run build` needs no `DATABASE_URL` and a newly analyzed repository is
 * listed without a redeploy.
 */
export const dynamic = "force-dynamic";

/**
 * The home page, `/explore`, and every repository Overview that `isIndexableLore`
 * accepts — the same rule its page's `robots`
 * metadata uses, so the sitemap never lists a page that says `noindex`.
 * A database error degrades to just the home page and `/explore` (which
 * renders an empty state then) rather than a 500, since crawlers would
 * otherwise back off the whole sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteMetadataBase();
  const home: MetadataRoute.Sitemap[number] = {
    url: new URL("/", base).toString(),
  };
  const explore: MetadataRoute.Sitemap[number] = {
    url: new URL("/explore", base).toString(),
  };

  let rows;
  try {
    rows = await listLatestRunIndexabilityFacts();
  } catch (error) {
    console.error("sitemap: failed to list repositories:", error);
    return [home, explore];
  }

  return [
    home,
    explore,
    ...rows.filter(isIndexableLore).map((row) => ({
      url: new URL(`/lore/${row.owner}/${row.repo}`, base).toString(),
      lastModified: row.createdAt,
    })),
  ];
}
