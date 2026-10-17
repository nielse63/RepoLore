import Link from "next/link";

/** The top bar on pages outside a Lore: the wordmark home link plus `/explore`. */
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-5">
      <Link
        href="/"
        className="font-serif text-xl font-semibold text-foreground"
      >
        Repo Lore
      </Link>
      <nav aria-label="Site">
        <Link
          href="/explore"
          className="text-sm font-medium text-muted hover:text-foreground"
        >
          Explore Lores
        </Link>
      </nav>
    </header>
  );
}
