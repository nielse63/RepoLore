import { siteMetadataBase } from "@/lib/route-metadata";
import type { MetadataRoute } from "next";

/**
 * Allows every crawler everywhere — which repository pages are actually
 * indexed is decided per page by its `robots` metadata and by
 * `sitemap.ts`, both via `isIndexableLore`, not here.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: new URL("/sitemap.xml", siteMetadataBase()).toString(),
  };
}
