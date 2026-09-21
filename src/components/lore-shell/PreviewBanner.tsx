import { Info } from "lucide-react";

/** Marks a page as example/placeholder content — see docs/product/non-goals.md's Explicit Exclusions. */
export function PreviewBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-lg bg-tile-supporting-bg px-4 py-3 text-sm text-tile-supporting-fg">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
