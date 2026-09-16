import { cn } from "@/lib/cn";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";

export function Pagination({
  className,
  ...props
}: React.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex justify-center", className)}
      {...props}
    />
  );
}

export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return <ul className={cn("flex items-center gap-1", className)} {...props} />;
}

export function PaginationItem(props: React.ComponentProps<"li">) {
  return <li {...props} />;
}

const controlClasses =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-border/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

export function PaginationLink({
  isActive,
  className,
  ...props
}: React.ComponentProps<"button"> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      className={cn(
        controlClasses,
        isActive && "bg-primary text-primary-foreground hover:bg-primary-hover",
        className
      )}
      {...props}
    />
  );
}

export function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label="Go to previous page"
      className={cn(controlClasses, "px-2.5", className)}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      Previous
    </button>
  );
}

export function PaginationNext({
  className,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label="Go to next page"
      className={cn(controlClasses, "px-2.5", className)}
      {...props}
    >
      Next
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center text-muted",
        className
      )}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
    </span>
  );
}
