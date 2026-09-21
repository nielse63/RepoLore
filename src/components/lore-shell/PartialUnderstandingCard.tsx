"use client";

import { Card } from "@/components/ui/Card";
import { TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function PartialUnderstandingCard({ gapsCount }: { gapsCount: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <section id="partial-understanding-card">
      <Card className="bg-red-100">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted flex items-center">
            <TriangleAlert className="mr-2" />
            <strong>Understanding is partial</strong>
          </p>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="-m-2.5 rounded p-2.5 text-muted hover:bg-border/20 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2">
          {gapsCount === 0
            ? "Some parts of the analysis could not be completed."
            : `Repo Lore found ${gapsCount} gap${
                gapsCount === 1 ? "" : "s"
              } while analyzing this repository, so some conclusions may be incomplete.`}
        </p>
        {gapsCount > 0 && (
          <Link
            href="#gaps"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View gaps →
          </Link>
        )}
      </Card>
    </section>
  );
}
