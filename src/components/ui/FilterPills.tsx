"use client";

import { cn } from "@/lib/cn";

export interface FilterPillOption {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

/** Mutually-exclusive filter buttons (Systems' All/Core/Supporting/Data, Data flow's Journey/Diagram/List). */
export function FilterPills({
  options,
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  options: FilterPillOption[];
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-tile-core-bg text-tile-core-fg"
                : "text-muted hover:text-foreground"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
