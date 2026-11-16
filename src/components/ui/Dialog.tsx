"use client";

import { cn } from "@/lib/cn";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export const Dialog = RadixDialog.Root;
export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

/**
 * A centered modal over the already-installed Radix Dialog (same pattern as
 * `Drawer.tsx`): focus containment, Escape and overlay dismissal, and an
 * always-visible close button. Long content scrolls inside the dialog.
 */
export function DialogContent({
  className,
  closeLabel = "Close dialog",
  children,
  ...props
}: React.ComponentProps<typeof RadixDialog.Content> & {
  closeLabel?: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-xl outline-none",
          className
        )}
        {...props}
      >
        {children}
        <RadixDialog.Close
          aria-label={closeLabel}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-md border border-border text-muted hover:bg-wash hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
