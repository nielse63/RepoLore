"use client";

import * as Popover from "@radix-ui/react-popover";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/cn";

export interface DateRange {
  from: Date;
  to: Date;
}

function formatShort(date: Date, withYear: boolean): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

/** "Last N days" while unchanged from `defaultRange`, otherwise a formatted date range (matches `docs/designs/history.png`). */
export function formatTimeframeLabel(
  range: DateRange,
  defaultRange: DateRange
): string {
  if (
    isSameDay(range.from, defaultRange.from) &&
    isSameDay(range.to, defaultRange.to)
  ) {
    const days = Math.round(
      (defaultRange.to.getTime() - defaultRange.from.getTime()) / 86_400_000
    );
    return `Last ${days} days`;
  }
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  return `${formatShort(range.from, !sameYear)} – ${formatShort(range.to, true)}`;
}

// react-day-picker renders modifier state (selected/today/outside/disabled)
// on the `<td>` wrapping each day, not on the `<button>` itself, so those
// modifiers style the button via a `[&>button]` descendant selector.
const dayPickerClassNames = {
  months: "relative",
  month: "space-y-2",
  month_caption:
    "flex items-center justify-center px-8 py-1 text-sm font-semibold text-foreground",
  nav: "absolute inset-x-0 top-0 flex items-center justify-between",
  button_previous:
    "flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-border/30 hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-30",
  button_next:
    "flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-border/30 hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-30",
  chevron: "h-4 w-4 fill-current",
  month_grid: "w-full table-fixed border-collapse",
  weekday: "h-8 w-8 text-center text-xs font-medium text-muted",
  day: "p-0 text-center align-middle",
  day_button:
    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm text-foreground transition-colors hover:bg-border/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-30",
  today: "[&>button]:font-semibold [&>button]:text-primary",
  selected:
    "[&>button]:!bg-primary [&>button]:!text-primary-foreground [&>button]:hover:!bg-primary",
  outside: "[&>button]:text-muted/40",
};

function DateField({
  label,
  date,
  active,
  onToggle,
}: {
  label: string;
  date: Date;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={active}
      onClick={onToggle}
      className={cn(
        "flex flex-1 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-primary" : "border-border hover:border-primary/50"
      )}
    >
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-medium text-foreground">
        {formatShort(date, true)}
      </span>
    </button>
  );
}

export function TimeframePicker({
  id,
  range,
  defaultRange,
  minDate,
  maxDate,
  onChange,
}: {
  id?: string;
  range: DateRange;
  defaultRange: DateRange;
  minDate: Date;
  maxDate: Date;
  onChange: (range: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<"from" | "to" | null>(null);
  const days = Math.round(
    (defaultRange.to.getTime() - defaultRange.from.getTime()) / 86_400_000
  );

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setActiveField(null);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {formatTimeframeLabel(range, defaultRange)}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[19rem] rounded-xl border border-border bg-surface p-4 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <DateField
              label="From"
              date={range.from}
              active={activeField === "from"}
              onToggle={() =>
                setActiveField((f) => (f === "from" ? null : "from"))
              }
            />
            <span className="mt-4 text-muted" aria-hidden="true">
              &rarr;
            </span>
            <DateField
              label="To"
              date={range.to}
              active={activeField === "to"}
              onToggle={() => setActiveField((f) => (f === "to" ? null : "to"))}
            />
          </div>

          {activeField && (
            <div className="mt-3 border-t border-border pt-3">
              <DayPicker
                mode="single"
                selected={activeField === "from" ? range.from : range.to}
                defaultMonth={activeField === "from" ? range.from : range.to}
                onSelect={(date) => {
                  if (!date) return;
                  if (activeField === "from") {
                    onChange({
                      from: date,
                      to: date > range.to ? date : range.to,
                    });
                  } else {
                    onChange({
                      from: date < range.from ? date : range.from,
                      to: date,
                    });
                  }
                  setActiveField(null);
                }}
                startMonth={minDate}
                endMonth={maxDate}
                disabled={[{ before: minDate }, { after: maxDate }]}
                classNames={dayPickerClassNames}
              />
            </div>
          )}

          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <button
              type="button"
              onClick={() => {
                onChange(defaultRange);
                setActiveField(null);
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Reset to last {days} days
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
