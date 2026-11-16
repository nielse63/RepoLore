"use client";

import { Button } from "@/components/ui/Button";
import { Check, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const COPIED_RESET_MS = 2000;

type CopyState = "idle" | "copied" | "manual";

/**
 * A labeled, read-only value with a copy button. When the Clipboard API is
 * unavailable or denied, the value is selected and the reader is told to
 * copy it by hand, so copying never silently fails.
 */
export function CopyField({
  label,
  value,
  copyLabel,
  multiline = false,
}: {
  label: string;
  value: string;
  /** Accessible name of the copy button, e.g. "Copy Markdown". */
  copyLabel: string;
  multiline?: boolean;
}) {
  const id = useId();
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state !== "copied") return;
    const timeoutId = setTimeout(() => setState("idle"), COPIED_RESET_MS);
    return () => clearTimeout(timeoutId);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      fieldRef.current?.focus();
      fieldRef.current?.select();
      setState("manual");
    }
  }

  const fieldClassName =
    "block w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </label>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
        {multiline ? (
          <textarea
            id={id}
            ref={fieldRef}
            readOnly
            value={value}
            rows={value.split("\n").length}
            className={`${fieldClassName} field-sizing-content resize-none`}
          />
        ) : (
          <input
            id={id}
            ref={fieldRef}
            readOnly
            value={value}
            className={fieldClassName}
          />
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={copy}
          aria-label={copyLabel}
          className="shrink-0"
        >
          {state === "copied" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {state === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      <p role="status" className="mt-1 text-xs text-muted empty:hidden">
        {state === "copied"
          ? "Copied to the clipboard."
          : state === "manual"
            ? "Couldn't copy automatically. The text is selected — press Ctrl+C (⌘C on a Mac) to copy it."
            : ""}
      </p>
    </div>
  );
}
