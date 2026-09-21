"use client";

import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { AreaDependencyDiagram } from "@/components/lore-shell/AreaDependencyDiagram";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { TopBar } from "@/components/lore-shell/TopBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  FilterPills,
  type FilterPillOption,
} from "@/components/ui/FilterPills";
import { IconTile, type IconTileVariant } from "@/components/ui/IconTile";
import { SearchInput } from "@/components/ui/SearchInput";
import { formatPath } from "@/lib/format-path";
import { deriveProductionAreaDiagramLayout } from "@/lore/area-diagram-layout";
import type { Lore, StructuralArea } from "@/lore/model";
import {
  classifySystem,
  type SystemClassification,
} from "@/lore/system-classification";
import { assignSystemSlugs } from "@/lore/system-slug";
import { ChevronRight, Layers } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const FILTERS: FilterPillOption[] = [
  { value: "all", label: "All" },
  { value: "Implementation area", label: "Implementation" },
  { value: "Tests / test support", label: "Tests" },
  { value: "Build/tooling configuration", label: "Tooling" },
];

const TILE_VARIANT_BY_CLASSIFICATION: Record<
  SystemClassification,
  IconTileVariant
> = {
  "Implementation area": "core",
  "Tests / test support": "supporting",
  "Build/tooling configuration": "neutral",
};

const BADGE_VARIANT_BY_CLASSIFICATION: Record<
  SystemClassification,
  BadgeVariant
> = {
  "Implementation area": "core",
  "Tests / test support": "supporting",
  "Build/tooling configuration": "neutral",
};

export interface SystemsContentProps {
  owner: string;
  repo: string;
  lore: Lore;
  repoIdentity: {
    statusLabel: string;
    statusTone?: "success" | "alert";
    updatedLabel: string;
    branch: string;
    language: string;
  };
}

/**
 * Real Systems view (ADR-0014): a renamed, re-presented view of the existing
 * Major Area (`StructuralArea`) model — no new analyzer capability, no
 * infrastructure/data-store nodes. Search/filter and the right-rail system
 * map reuse exactly the data Architecture/Overview already compute.
 */
export function SystemsContent({
  owner,
  repo,
  lore,
  repoIdentity,
}: SystemsContentProps) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");

  const commitSha = lore.snapshot.commitSha;

  // The root directory ("." — a file with no directory of its own) adds no
  // orientation value as a system, matching Architecture/Overview's existing
  // Major Areas exclusion.
  const majorAreas = useMemo(
    () => lore.structuralAreas.filter((area) => area.name !== "."),
    [lore.structuralAreas]
  );
  const diagramLayout = useMemo(
    () => deriveProductionAreaDiagramLayout(majorAreas, lore.relationships),
    [majorAreas, lore.relationships]
  );
  const slugEntries = useMemo(
    () => assignSystemSlugs(majorAreas),
    [majorAreas]
  );
  const totalEvidence = majorAreas.reduce(
    (sum, area) => sum + area.evidence.length,
    0
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slugEntries.filter(({ area }) => {
      const matchesKind = kind === "all" || classifySystem(area) === kind;
      const matchesQuery = q === "" || area.name.toLowerCase().includes(q);
      return matchesKind && matchesQuery;
    });
  }, [slugEntries, query, kind]);

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <RepoIdentity
              owner={owner}
              repo={repo}
              statusLabel={repoIdentity.statusLabel}
              statusTone={repoIdentity.statusTone}
              updatedLabel={repoIdentity.updatedLabel}
              branch={repoIdentity.branch}
              language={repoIdentity.language}
              visibility={
                lore.snapshot.repository.isPrivate ? "Private" : "Public"
              }
            />
          }
          actions={<ReanalyzeButton owner={owner} repo={repo} />}
        />
      }
      rightRail={
        <RightRailShell title="System map">
          <p className="text-sm text-muted">
            How this repository&apos;s systems relate.
          </p>
          {diagramLayout ? (
            <div className="mt-4">
              <AreaDependencyDiagram
                areas={majorAreas}
                relationships={lore.relationships}
                owner={owner}
                repo={repo}
                commitSha={commitSha}
              />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Not enough systems were detected to diagram.
            </p>
          )}
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
          {majorAreas.length} {majorAreas.length === 1 ? "system" : "systems"}{" "}
          identified ·{" "}
          <span className="font-medium text-primary">
            {totalEvidence} supporting references
          </span>
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label htmlFor="systems-search" className="sr-only">
            Search systems
          </label>
          <SearchInput
            id="systems-search"
            placeholder="Search systems"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            className="flex-1"
          />
          <FilterPills
            aria-label="Filter by classification"
            options={FILTERS}
            value={kind}
            onChange={setKind}
          />
        </div>

        <Card className="mt-4 p-0">
          <ul className="divide-y divide-border">
            {filtered.map(({ area, slug }) => (
              <SystemRow
                key={area.id}
                owner={owner}
                repo={repo}
                area={area}
                slug={slug}
              />
            ))}
            {filtered.length === 0 && (
              <li className="px-6 py-8 text-center text-sm text-muted">
                {majorAreas.length === 0
                  ? "No systems were detected for this repository."
                  : "No systems match your search."}
              </li>
            )}
          </ul>
        </Card>
        <p className="mt-3 text-sm text-muted">
          Showing 1–{filtered.length} of {majorAreas.length} systems
        </p>
      </div>
    </LorePageFrame>
  );
}

function SystemRow({
  owner,
  repo,
  area,
  slug,
}: {
  owner: string;
  repo: string;
  area: StructuralArea;
  slug: string;
}) {
  const classification = classifySystem(area);
  return (
    <li>
      <Link
        href={`/lore/${owner}/${repo}/systems/${slug}`}
        className="flex items-center gap-4 px-6 py-4 hover:bg-border/10"
      >
        <IconTile
          icon={Layers}
          variant={TILE_VARIANT_BY_CLASSIFICATION[classification]}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {formatPath(area.name)}
            </p>
            <Badge variant={BADGE_VARIANT_BY_CLASSIFICATION[classification]}>
              {classification}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {area.responsibility ?? area.rationale}
          </p>
        </div>
        <div className="hidden shrink-0 gap-8 text-xs text-muted sm:flex">
          <div>
            <p>Relationships</p>
            <p className="mt-0.5 text-sm text-foreground">
              {area.directDependencyIds.length + area.directDependentIds.length}
            </p>
          </div>
          <div>
            <p>Evidence</p>
            <p className="mt-0.5 text-sm text-foreground">
              {area.evidence.length}
            </p>
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
