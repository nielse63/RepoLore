"use client";

import { cn } from "@/lib/cn";
import * as RadixDialog from "@radix-ui/react-dialog";

export const Drawer = RadixDialog.Root;
export const DrawerTrigger = RadixDialog.Trigger;
export const DrawerClose = RadixDialog.Close;
export const DrawerTitle = RadixDialog.Title;

const SIDE_CLASSES = {
  left: "inset-y-0 left-0 w-[85vw] max-w-80 border-r border-border",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t border-border",
} as const;

export function DrawerContent({
  side,
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Content> & {
  side: keyof typeof SIDE_CLASSES;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
      <RadixDialog.Content
        className={cn(
          "fixed z-50 flex flex-col bg-surface outline-none",
          SIDE_CLASSES[side],
          className
        )}
        {...props}
      />
    </RadixDialog.Portal>
  );
}
