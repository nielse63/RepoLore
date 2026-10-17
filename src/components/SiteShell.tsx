import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * Page chrome for every route outside a Lore (home, `/explore`,
 * `/manifesto`, not-found, an unanalyzed repository): `SiteHeader`, the
 * page's `<main>`, then `SiteFooter`, filling at least the viewport.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-background">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}
