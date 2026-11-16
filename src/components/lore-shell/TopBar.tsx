"use client";

import { useLoreShell } from "@/components/lore-shell/LoreShellContext";
import { MobileNavTrigger } from "@/components/lore-shell/MobileNavTrigger";
import { Button } from "@/components/ui/Button";
import { FileSearch, Share2 } from "lucide-react";
import Link from "next/link";

/**
 * The Lore header (issue #84): brand, a `Lores / owner / repo` trail, and
 * the Analysis and Share actions. Spans the full width above the
 * navigation; at compact widths the trail moves to its own line.
 */
export function TopBar({ owner, repo }: { owner: string; repo: string }) {
  const { openDialog } = useLoreShell();

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface px-4 py-3 min-[661px]:px-7 min-[661px]:py-4">
      <Link
        href="/"
        className="font-serif text-2xl font-medium tracking-tight text-foreground"
      >
        Repo Lore
      </Link>
      <p className="order-last w-full min-w-0 text-xs text-muted [overflow-wrap:anywhere] min-[661px]:order-none min-[661px]:w-auto min-[661px]:border-l min-[661px]:border-border min-[661px]:pl-6">
        <Link href="/explore" className="hover:text-foreground">
          Lores
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="sr-only">, </span>
        {owner}
        <span aria-hidden="true"> / </span>
        <span className="sr-only">, </span>
        <Link
          href={`/lore/${owner}/${repo}`}
          className="font-medium text-foreground hover:underline"
        >
          {repo}
        </Link>
      </p>
      <div className="ml-auto flex items-center gap-2">
        <MobileNavTrigger />
        <Button
          type="button"
          variant="secondary"
          className="px-3"
          onClick={(e) => openDialog("analysis", e.currentTarget)}
        >
          <FileSearch className="h-4 w-4" aria-hidden="true" />
          Analysis
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="px-3"
          onClick={(e) => openDialog("share", e.currentTarget)}
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
      </div>
    </header>
  );
}
