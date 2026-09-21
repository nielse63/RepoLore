"use client";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/Drawer";
import { PanelRightOpen, X } from "lucide-react";
import { useId, useState } from "react";

export function RightRailShell({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headingId = useId();

  return (
    <>
      {open ? (
        <aside
          className="sticky top-0 hidden max-h-dvh w-[360px] shrink-0 flex-col border-l border-border bg-surface lg:flex"
          id="right-rail"
          aria-labelledby={headingId}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2
              id={headingId}
              className="text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={`Close ${title} panel`}
              className="rounded p-1 text-muted hover:bg-border/20 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </aside>
      ) : (
        <div className="hidden shrink-0 border-l border-border px-2 py-6 lg:block">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-border/20 hover:text-foreground"
            aria-label={`Show ${title} panel`}
          >
            <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-30 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-lg hover:bg-border/20"
          aria-label={`Show ${title} panel`}
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          Details
        </button>
      </div>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent side="bottom">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <DrawerTitle className="text-lg font-semibold text-foreground">
              {title}
            </DrawerTitle>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={`Close ${title} panel`}
              className="rounded p-1 text-muted hover:bg-border/20 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
