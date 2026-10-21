import { LoreCard } from "@/components/LoreCard";
import { SiteShell } from "@/components/SiteShell";
import {
  listLatestRunIndexabilityFacts,
  type LatestRunIndexabilityRow,
} from "@/db/analysis-runs";
import { indexableLores } from "@/lib/featured-lores";
import type { Metadata } from "next";
import Link from "next/link";

/** Per request, like `sitemap.ts`: no `DATABASE_URL` at build, no redeploy for new Lores. */
export const dynamic = "force-dynamic";

const TITLE = "Explore codebase Lores — Repo Lore";
const DESCRIPTION =
  "Browse evidence-backed orientation guides for popular TypeScript, JavaScript, and Python repositories: entry points, major structural areas, and where to start reading.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/explore" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/explore",
    siteName: "Repo Lore",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

/**
 * Every indexable Lore (`isIndexableLore`, the sitemap's rule), so each is
 * one internal link from the home page rather than reachable only through
 * the sitemap. A database error renders the empty state rather than a 500.
 */
export default async function ExplorePage() {
  let lores: LatestRunIndexabilityRow[] = [];
  try {
    lores = indexableLores(await listLatestRunIndexabilityFacts());
  } catch (error) {
    console.error("explore: failed to list Lores:", error);
  }

  return (
    <SiteShell>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Explore Lores
        </h1>
        <p className="mt-3 max-w-2xl text-base text-muted">
          Evidence-backed orientation for open-source repositories: probable
          entry points, major structural areas, and a place to start reading.
        </p>

        {lores.length > 0 ? (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lores.map((lore) => (
              <LoreCard key={`${lore.owner}/${lore.repo}`} lore={lore} />
            ))}
          </ul>
        ) : (
          <p className="mt-10 text-base text-muted">
            No Lores to show yet.{" "}
            <Link href="/" className="font-medium text-primary hover:underline">
              Analyze a repository
            </Link>{" "}
            to create the first one.
          </p>
        )}
      </main>
    </SiteShell>
  );
}
