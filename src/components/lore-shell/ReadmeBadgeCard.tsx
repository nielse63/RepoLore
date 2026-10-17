"use client";

import { Button } from "@/components/ui/Button";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

const COPIED_RESET_MS = 2000;

/**
 * "Add a README badge" section of the Overview's Analysis rail.
 * No mockup covers it, so it follows the rail's
 * existing bordered-section pattern. The snippet stays visible and
 * selectable, so copying still works by hand if the Clipboard API is
 * unavailable or denied.
 */
export function ReadmeBadgeCard({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeoutId = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timeoutId);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
    } catch {
      // Left to the visible snippet; nothing else to fall back to.
    }
  }

  return (
    <section
      className="mt-6 border-t border-border pt-4"
      aria-labelledby="readme-badge-heading"
    >
      <h3
        id="readme-badge-heading"
        className="text-sm font-semibold text-foreground"
      >
        Add a README badge
      </h3>
      <p className="mt-1 text-sm text-muted">
        Link this Lore from the repository&apos;s README.
      </p>
      <code className="mt-3 block break-all rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground">
        {snippet}
      </code>
      <Button
        type="button"
        variant="secondary"
        onClick={copy}
        className="mt-3 w-full"
      >
        {copied ? (
          <Check className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
        <span aria-live="polite">
          {copied ? "Copied" : "Copy badge Markdown"}
        </span>
      </Button>
    </section>
  );
}
