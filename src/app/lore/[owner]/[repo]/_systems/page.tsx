"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TopBar } from "@/components/lore-shell/TopBar";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { PreviewBanner } from "@/components/lore-shell/PreviewBanner";
import { PreviewActions } from "@/components/lore-shell/PreviewActions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { IconTile } from "@/components/ui/IconTile";
import { SearchInput } from "@/components/ui/SearchInput";
import { FilterPills } from "@/components/ui/FilterPills";
import { SYSTEMS, type SystemSummary } from "@/lib/fixtures/payments-service";
import { ICONS } from "@/lib/fixtures/icons";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "Core", label: "Core" },
  { value: "Supporting", label: "Supporting" },
  { value: "Data", label: "Data" },
];

const totalEvidence = SYSTEMS.reduce((sum, s) => sum + s.evidence, 0);

export default function SystemsPage() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");

  const filtered = useMemo(() => {
    return SYSTEMS.filter((s) => {
      const matchesKind = kind === "all" || s.kind === kind;
      const matchesQuery =
        query.trim() === "" ||
        s.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesKind && matchesQuery;
    });
  }, [query, kind]);

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel="Analysis current"
              updatedLabel="Analyzed 2 hours ago"
              branch="main"
              language="Python"
            />
          }
          actions={<PreviewActions />}
        />
      }
      rightRail={
        <RightRailShell title="System map">
          <p className="text-sm text-muted">
            How the repository&apos;s systems relate.
          </p>
          <ul className="mt-4 space-y-3">
            {SYSTEMS.map((system) => {
              const Icon = ICONS[system.icon];
              return (
                <li key={system.slug} className="flex items-center gap-2.5">
                  <IconTile icon={Icon} variant={system.variant} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {system.name}
                    </p>
                    <p className="text-xs text-muted">{system.kind}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <IconTile
                icon={ICONS.box}
                variant="core"
                size="sm"
                className="h-5 w-5"
              />{" "}
              Core
            </span>
            <span className="flex items-center gap-1.5">
              <IconTile
                icon={ICONS.gear}
                variant="supporting"
                size="sm"
                className="h-5 w-5"
              />{" "}
              Supporting
            </span>
            <span className="flex items-center gap-1.5">
              <IconTile
                icon={ICONS.database}
                variant="data"
                size="sm"
                className="h-5 w-5"
              />{" "}
              Data
            </span>
          </div>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Systems
        </h1>
        <p className="mt-2 text-base text-muted">
          The responsibilities, boundaries, and relationships that make up this
          repository.
        </p>
        <p className="mt-1 text-sm text-muted">
          {SYSTEMS.length} systems identified ·{" "}
          <span className="font-medium text-primary">
            {totalEvidence} supporting references
          </span>
        </p>

        <PreviewBanner>
          Showing example data for illustration. System detection isn&apos;t
          implemented yet for this repository.
        </PreviewBanner>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput
            placeholder="Search systems"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            className="flex-1"
          />
          <FilterPills
            aria-label="Filter by system kind"
            options={FILTERS}
            value={kind}
            onChange={setKind}
          />
        </div>

        <Card className="mt-4 p-0">
          <ul className="divide-y divide-border">
            {filtered.map((system) => (
              <SystemRow
                key={system.slug}
                owner={owner}
                repo={repo}
                system={system}
              />
            ))}
            {filtered.length === 0 && (
              <li className="px-6 py-8 text-center text-sm text-muted">
                No systems match your search.
              </li>
            )}
          </ul>
        </Card>
        <p className="mt-3 text-sm text-muted">
          Showing 1–{filtered.length} of {SYSTEMS.length} systems
        </p>
      </div>
    </LorePageFrame>
  );
}

function SystemRow({
  owner,
  repo,
  system,
}: {
  owner: string;
  repo: string;
  system: SystemSummary;
}) {
  const Icon = ICONS[system.icon];
  return (
    <li>
      <Link
        href={`/lore/${owner}/${repo}/systems/${system.slug}`}
        className="flex items-center gap-4 px-6 py-4 hover:bg-border/10"
      >
        <IconTile icon={Icon} variant={system.variant} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {system.name}
            </p>
            <Badge variant={system.variant}>{system.kind}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted">{system.description}</p>
        </div>
        <div className="hidden shrink-0 gap-8 text-xs text-muted sm:flex">
          <div>
            <p>Technology</p>
            <p className="mt-0.5 text-sm text-foreground">
              {system.technology}
            </p>
          </div>
          <div>
            <p>Owned paths</p>
            <p className="mt-0.5 font-mono text-sm text-foreground">
              {system.ownedPaths}
            </p>
          </div>
          <div>
            <p>Relationships</p>
            <p className="mt-0.5 text-sm text-foreground">
              {system.relationships}
            </p>
          </div>
          <div>
            <p>Evidence</p>
            <p className="mt-0.5 text-sm text-foreground">{system.evidence}</p>
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}
