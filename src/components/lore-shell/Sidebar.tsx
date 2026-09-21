"use client";

import { useMobileNav } from "@/components/lore-shell/MobileNavContext";
import { Badge } from "@/components/ui/Badge";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/Drawer";
import { cn } from "@/lib/cn";
import {
  Clock,
  FolderGit2,
  Home,
  Network,
  Package,
  Share2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const NAV_ITEMS = [
  { slug: "", label: "Overview", icon: Home },
  { slug: "architecture", label: "Architecture", icon: Network },
  { slug: "systems", label: "Systems", icon: Package },
  { slug: "dependencies", label: "Dependencies", icon: Share2 },
  { slug: "data-flow", label: "Data Flow", icon: Waypoints },
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
  const { open, setOpen } = useMobileNav();
  const base = `/lore/${owner}/${repo}`;

  // Auto-close the mobile drawer whenever navigation completes.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  const content = (
    <SidebarNav
      owner={owner}
      repo={repo}
      visibility={visibility}
      pathname={pathname}
      base={base}
    />
  );

  return (
    <>
      <aside
        aria-label="Repository navigation and status"
        className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar lg:flex"
      >
        {content}
      </aside>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left">
          <DrawerTitle className="sr-only">
            Repository navigation and status
          </DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function SidebarNav({
  owner,
  repo,
  visibility,
  pathname,
  base,
}: {
  owner: string;
  repo: string;
  visibility: string;
  pathname: string | null;
  base: string;
}) {
  return (
    <>
      <div className="px-5 py-5">
        <Link
          href="/"
          className="font-serif text-xl font-semibold text-foreground"
        >
          Repo Lore
        </Link>
      </div>

      <div className="px-3">
        <a
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-left hover:bg-border/20"
          id="lore-overview-button"
          href={base}
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
        </a>
      </div>

      <nav
        className="mt-4 flex-1 space-y-0.5 px-3"
        aria-label="Repository sections"
      >
        {NAV_ITEMS.map((item) => {
          const href = item.slug ? `${base}/${item.slug}` : base;
          const active = item.slug
            ? (pathname?.startsWith(href) ?? false)
            : pathname === href;
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
          <p className="mt-2 text-sm text-muted">
            Every claim is grounded in code, configuration, and infrastructure.
          </p>
        </div>

        {/* Repository settings is not implemented yet; `/repository-settings`
            currently 404s (see the route's own stub comment). */}
        {/* <Link
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
        </Link> */}
      </div>
    </>
  );
}
