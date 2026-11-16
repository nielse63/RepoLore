"use client";

import { useMobileNav } from "@/components/lore-shell/MobileNavContext";
import { Menu } from "lucide-react";

export function MobileNavTrigger() {
  const { setOpen } = useMobileNav();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border text-muted hover:bg-wash hover:text-foreground min-[661px]:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
