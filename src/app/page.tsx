import { HomeContent } from "@/components/HomeContent";
import type { Metadata } from "next";

/**
 * Only the home page's canonical lives here rather than on the root layout:
 * a layout-level `alternates.canonical` is inherited by every child route
 * that doesn't declare its own, which wrongly pointed every such route
 * (including 404s) at the home page (see
 * docs/architecture/ux-seo-a11y-remediation-plan.md, "Deferred").
 * Title/description/Open Graph/Twitter stay on the root layout
 * since those are reasonable shared defaults for routes with no metadata of
 * their own.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <HomeContent />;
}
