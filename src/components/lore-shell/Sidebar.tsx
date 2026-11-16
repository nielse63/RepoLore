"use client";

import { useMobileNav } from "@/components/lore-shell/MobileNavContext";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/Drawer";
import { cn } from "@/lib/cn";
import { Clock, Home, Network, Package, Share2, Waypoints } from "lucide-react";
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

/**
 * The Lore's section navigation (issue #84): a quiet 173px column of the six
 * sections. Below 661px it moves into a drawer opened from the header's
 * menu button.
 */
export function Sidebar({ owner, repo }: { owner: string; repo: string }) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const base = `/lore/${owner}/${repo}`;

  // Auto-close the mobile drawer whenever navigation completes.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  const content = <SidebarNav pathname={pathname} base={base} />;

  return (
    <>
      <aside
        aria-label="Repository navigation"
        className="hidden w-[173px] shrink-0 flex-col border-r border-border bg-sidebar min-[661px]:flex"
      >
        {content}
      </aside>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent side="left" className="bg-sidebar">
          <DrawerTitle className="sr-only">Repository navigation</DrawerTitle>
          {content}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function SidebarNav({
  pathname,
  base,
}: {
  pathname: string | null;
  base: string;
}) {
  return (
    <div className="flex flex-1 flex-col px-3 py-6">
      <p
        aria-hidden="true"
        className="px-3 pb-3 text-2xs font-medium uppercase tracking-widest text-muted"
      >
        Understand
      </p>
      <nav className="space-y-1" aria-label="Repository sections">
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
                "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-wash font-medium text-primary"
                  : "text-muted hover:bg-wash hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pt-10 text-xs text-muted">
        <p className="font-medium text-foreground">A map you can trust.</p>
        <p className="mt-1.5">Important findings lead back to the source.</p>
        <Link
          href="/explore"
          className="mt-4 inline-block hover:text-foreground"
        >
          ← All Lores
        </Link>
      </div>
    </div>
  );
}
