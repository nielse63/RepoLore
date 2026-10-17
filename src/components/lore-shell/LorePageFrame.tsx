import { SiteFooter } from "@/components/SiteFooter";

export function LorePageFrame({
  topBar,
  rightRail,
  children,
}: {
  topBar: React.ReactNode;
  rightRail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      {topBar}
      <div className="flex min-h-0 flex-1">
        {/* The footer is a sibling of <main>, not inside it, so it keeps its
            `contentinfo` landmark role; `flex-1` on <main> keeps it at the
            bottom of the column on short pages. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <main id="lore-main-content" tabIndex={-1} className="flex-1">
            {children}
          </main>
          {/* pb-16 clears the fixed mobile "Details" button (RightRailShell). */}
          <SiteFooter spacingClassName="mt-12 pt-6 pb-16 lg:pb-0" />
        </div>
        {rightRail}
      </div>
    </div>
  );
}
