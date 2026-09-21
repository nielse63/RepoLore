import { MobileNavTrigger } from "@/components/lore-shell/MobileNavTrigger";

export function TopBar({
  left,
  actions,
}: {
  left: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 lg:gap-4 lg:px-8 lg:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavTrigger />
        <div className="min-w-0">{left}</div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </header>
  );
}
