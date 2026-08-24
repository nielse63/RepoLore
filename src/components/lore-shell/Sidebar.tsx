"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  ChevronDown,
  Clock,
  FolderGit2,
  Home,
  Network,
  Settings,
  Share2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { slug: "", label: "Overview", icon: Home },
  { slug: "architecture", label: "Architecture", icon: Network },
  // { slug: 'systems', label: 'Systems', icon: Package },
  { slug: "dependencies", label: "Dependencies", icon: Share2 },
  { slug: "data-flow", label: "Data flow", icon: Waypoints },
  { slug: "history", label: "History", icon: Clock },
] as const;

export function Sidebar({
  owner,
  repo,
  visibility = "Public",
}: {
  owner: string;
  repo: string;
  visibility?: string;
}) {
  const pathname = usePathname();
  const base = `/lore/${owner}/${repo}`;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <div className="px-5 py-5">
        <Link
          href="/"
          className="font-serif text-xl font-semibold text-foreground"
        >
          Repo Lore
        </Link>
      </div>

      <div className="px-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-border/20"
        >
          <FolderGit2
            className="h-4 w-4 shrink-0 text-foreground"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {owner}/{repo}
            </span>
          </span>
          <Badge variant="primary" className="shrink-0">
            {visibility}
          </Badge>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-muted"
            aria-hidden="true"
          />
        </button>
      </div>

      <nav
        className="mt-4 flex-1 space-y-0.5 px-3"
        aria-label="Repository sections"
      >
        {NAV_ITEMS.map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-tile-core-bg text-tile-core-fg"
                  : "text-muted hover:bg-border/20 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 px-3 pb-3">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-start gap-2">
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold text-foreground">
              Evidence-backed insights you can trust.
            </p>
          </div>
          <p className="mt-2 text-xs text-muted">
            Every claim is grounded in code, configuration, and infrastructure.
          </p>
        </div>

        <Link
          href={`${base}/repository-settings`}
          aria-current={
            pathname === `${base}/repository-settings` ? "page" : undefined
          }
          className={cn(
            "flex items-center gap-2.5 rounded-lg border-t border-border px-3 pt-3 text-sm font-medium",
            pathname === `${base}/repository-settings`
              ? "text-tile-core-fg"
              : "text-muted hover:text-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
          Repository settings
        </Link>
      </div>
    </aside>
  );
}
