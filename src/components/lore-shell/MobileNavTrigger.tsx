"use client";

import { useMobileNav } from "@/components/lore-shell/MobileNavContext";
import { Menu } from "lucide-react";

export function MobileNavTrigger() {
  const { setOpen } = useMobileNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="shrink-0 rounded-lg p-2.5 text-muted hover:bg-border/20 hover:text-foreground lg:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
