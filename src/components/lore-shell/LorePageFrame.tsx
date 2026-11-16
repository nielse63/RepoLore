import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/cn";

/**
 * A Lore page's content area, beside the layout's header and navigation
 * (issue #84). `inspector` is the page's open `LoreInspector`, if any: on
 * wide screens it takes its own column; below that it follows the main
 * content, ahead of the footer.
 */
export function LorePageFrame({
  inspector,
  children,
}: {
  inspector?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 flex-1 grid-cols-1",
        inspector
          ? "grid-rows-[1fr_auto_auto] xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[1fr_auto]"
          : "grid-rows-[1fr_auto]"
      )}
    >
      <main
        id="lore-main-content"
        tabIndex={-1}
        className="min-w-0 overflow-x-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:col-start-1 xl:row-start-1"
      >
        {children}
      </main>
      {inspector}
      {/* The footer is a sibling of <main>, not inside it, so it keeps its
          `contentinfo` landmark role. */}
      <SiteFooter spacingClassName="mx-4 mt-4 pt-6 pb-8 sm:mx-6 lg:mx-8 xl:col-start-1 xl:row-start-2" />
    </div>
  );
}
