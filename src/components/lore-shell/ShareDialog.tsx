"use client";

import { CopyField } from "@/components/lore-shell/CopyField";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/Dialog";
import type { ReadmeBadgeSnippet } from "@/lib/readme-badge";

/**
 * Share the Lore (issue #84, replacing the Overview rail's badge card): its
 * stable URL, and README badge snippets in every format from issue #67.
 */
export function ShareDialog({
  loreUrl,
  badgeImageUrl,
  badgeSnippets,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  loreUrl: string;
  badgeImageUrl: string;
  badgeSnippets: ReadmeBadgeSnippet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel="Close share dialog"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <p className="text-2xs font-medium uppercase tracking-widest text-primary">
          Share understanding
        </p>
        <DialogTitle className="mt-1 pr-12 font-serif text-2xl text-foreground">
          Share this Lore
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm text-muted">
          Give the next contributor a starting point. This link always shows the
          repository&apos;s latest analysis.
        </DialogDescription>

        <div className="mt-5">
          <CopyField
            label="Lore URL"
            value={loreUrl}
            copyLabel="Copy Lore URL"
          />
        </div>

        <section aria-labelledby="share-badge-heading" className="mt-6">
          <h3
            id="share-badge-heading"
            className="text-sm font-semibold text-foreground"
          >
            Add a README badge
          </h3>
          <p className="mt-1 text-sm text-muted">
            Link this Lore from the repository&apos;s README.
          </p>
          <a
            href={loreUrl}
            className="mt-3 inline-block"
            aria-label="Badge preview, linking to this Lore"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, shown exactly as a README would */}
            <img src={badgeImageUrl} alt="Repo Lore" height={20} />
          </a>
          <div className="mt-3 space-y-4">
            {badgeSnippets.map(({ format, label, snippet }) => (
              <CopyField
                key={format}
                label={label}
                value={snippet}
                copyLabel={`Copy ${label}`}
                multiline={snippet.includes("\n")}
              />
            ))}
            <CopyField
              label="Badge image URL"
              value={badgeImageUrl}
              copyLabel="Copy badge image URL"
            />
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
