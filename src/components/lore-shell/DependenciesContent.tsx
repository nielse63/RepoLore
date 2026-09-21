"use client";

import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { MAX_PAGE_SIZE } from "@/components/lore-shell/PaginatedList";
import { RepoIdentity } from "@/components/lore-shell/RepoIdentity";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { TopBar } from "@/components/lore-shell/TopBar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { IconTile } from "@/components/ui/IconTile";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { SourceLink } from "@/components/ui/SourceLink";
import { Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import { cn } from "@/lib/cn";
import { dependencyCategoryIcon } from "@/lib/dependency-category";
import { formatPath } from "@/lib/format-path";
import { getPageItems } from "@/lib/pagination-range";
import { useFitPageSize } from "@/lib/use-fit-page-size";
import { usePersistedPage } from "@/lib/use-persisted-page";
import { deriveAreaRelationships } from "@/lore/area-relationships";
import type {
  ExternalDependency,
  ExternalDependencyScope,
  Lore,
} from "@/lore/model";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  FileText,
  Link2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const SCOPE_LABEL: Record<ExternalDependencyScope, string> = {
  direct: "Production",
  dev: "Development",
  peer: "Peer",
  optional: "Optional",
};

type SortColumn = "name" | "scope" | "evidence";
type SortDirection = "asc" | "desc";

function SortableTh({
  column,
  label,
  sort,
  onSort,
}: {
  column: SortColumn;
  label: string;
  sort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
}) {
  const active = sort.column === column;
  const Icon = !active
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;
  return (
    <Th
      aria-sort={
        active
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="-mx-2 -my-1.5 inline-flex items-center gap-1 rounded px-2 py-1.5 text-sm font-medium text-muted hover:bg-border/20 hover:text-foreground"
      >
        {label}
        <Icon
          className={cn("h-3 w-3", active && "text-foreground")}
          aria-hidden="true"
        />
      </button>
    </Th>
  );
}

function usageEvidence(dependency: ExternalDependency) {
  return dependency.evidence.filter((e) => e.kind === "import-reference");
}

/** Distinct files referencing this dependency, deduped by path (a file may produce more than one usage-evidence entry). */
function usedByLocations(dependency: ExternalDependency) {
  const seen = new Set<string>();
  const locations: (typeof dependency.evidence)[number][] = [];
  for (const evidence of usageEvidence(dependency)) {
    const path = evidence.location?.filePath;
    if (!path || seen.has(path)) continue;
    seen.add(path);
    locations.push(evidence);
  }
  return locations;
}

export interface DependenciesContentProps {
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

export function DependenciesContent({
  owner,
  repo,
  lore,
  repoIdentity,
}: DependenciesContentProps) {
  const [tab, setTab] = useState<"external" | "internal">("external");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{
    column: SortColumn;
    direction: SortDirection;
  }>({ column: "name", direction: "asc" });
  const toggleSort = (column: SortColumn) =>
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" }
    );
  const commitSha = lore.snapshot.commitSha;
  const sourceUrl = (location: Parameters<typeof githubBlobUrl>[3]) =>
    githubBlobUrl(owner, repo, commitSha, location);
  const areaUrl = (location: Parameters<typeof githubTreeUrl>[3]) =>
    githubTreeUrl(owner, repo, commitSha, location);

  const dependencies = useMemo(
    () =>
      [...lore.externalDependencies].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [lore.externalDependencies]
  );
  const filtered = useMemo(() => {
    const matches = dependencies.filter((d) =>
      d.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    const compare = (a: ExternalDependency, b: ExternalDependency) => {
      switch (sort.column) {
        case "name":
          return a.name.localeCompare(b.name);
        case "scope":
          return SCOPE_LABEL[a.scope].localeCompare(SCOPE_LABEL[b.scope]);
        case "evidence":
          return usageEvidence(a).length - usageEvidence(b).length;
      }
    };
    const sorted = [...matches].sort(compare);
    return sort.direction === "asc" ? sorted : sorted.reverse();
  }, [dependencies, query, sort]);

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const pageSize = useFitPageSize(tbodyRef, MAX_PAGE_SIZE);
  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const [page, setPage] = usePersistedPage(
    `dependencies-page:${owner}/${repo}:external`,
    pageCount
  );
  // Reset to page 1 whenever the search or sort actually changes — but not
  // on the initial mount, which would stomp the page restored from
  // sessionStorage before the user has touched either control.
  const skipNextReset = useRef(true);
  useEffect(() => {
    if (skipNextReset.current) {
      skipNextReset.current = false;
      return;
    }
    setPage(1);
  }, [query, sort.column, sort.direction, setPage]);
  const start = (page - 1) * pageSize;
  const pageFiltered = filtered.slice(start, start + pageSize);

  const [selectedId, setSelectedId] = useState(dependencies[0]?.id);
  const selected =
    filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? dependencies[0];

  const areaRelationships = deriveAreaRelationships(lore.structuralAreas);

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
        selected ? (
          <RightRailShell title={selected.name}>
            <Badge variant="primary">
              {SCOPE_LABEL[selected.scope]} dependency
            </Badge>

            <div className="mt-3">
              {selected.description ? (
                <>
                  <p className="text-sm text-muted">{selected.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    via {selected.descriptionSource === "pypi" ? "PyPI" : "npm"}{" "}
                    registry
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted">
                  No description available for this package.
                </p>
              )}
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground">Used by</p>
              <ul className="mt-2 space-y-2">
                {usedByLocations(selected).map((evidence) => (
                  <li key={evidence.location!.filePath} className="text-sm">
                    <SourceLink
                      location={evidence.location!}
                      sourceUrl={sourceUrl}
                    />
                  </li>
                ))}
                {usedByLocations(selected).length === 0 && (
                  <li className="text-sm text-muted">
                    No usage was matched in the analyzed source.
                  </li>
                )}
              </ul>
            </div>

            <div className="mt-6 border-t border-border pt-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4" aria-hidden="true" /> Evidence
              </p>
              <ul className="mt-2 space-y-2">
                {selected.evidence.map((evidence, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center gap-2">
                      {evidence.location && (
                        <SourceLink
                          location={evidence.location}
                          sourceUrl={sourceUrl}
                        />
                      )}
                      <CertaintyBadge certainty={evidence.certainty} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {evidence.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {selected.gaps.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground">Gaps</p>
                <ul className="mt-2 space-y-2">
                  {selected.gaps.map((gap, i) => (
                    <li key={i} className="text-sm">
                      <CertaintyBadge certainty={gap.certainty} />
                      <p className="mt-1 text-sm text-muted">
                        {gap.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </RightRailShell>
        ) : undefined
      }
    >
      <div className="max-w-4xl">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Dependencies
        </h1>
        <p className="mt-2 text-base text-muted">
          What this repository relies on, and where those dependencies are used.
        </p>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="mt-6"
        >
          <TabsList>
            <TabsTrigger
              value="external"
              tabIndex={tab === "external" ? 0 : -1}
            >
              External
            </TabsTrigger>
            <TabsTrigger
              value="internal"
              tabIndex={tab === "internal" ? 0 : -1}
            >
              Internal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="external">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="dependency-search" className="sr-only">
                Search dependencies
              </label>
              <SearchInput
                id="dependency-search"
                placeholder="Search dependencies…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery("")}
                className="sm:max-w-xs"
              />
              <p className="text-sm text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "dependency" : "dependencies"}
              </p>
            </div>

            <Card className="p-0">
              <Table>
                <Thead>
                  <Tr>
                    <SortableTh
                      column="name"
                      label="Dependency"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <SortableTh
                      column="scope"
                      label="Scope"
                      sort={sort}
                      onSort={toggleSort}
                    />
                    <Th>Version</Th>
                    <SortableTh
                      column="evidence"
                      label="Evidence"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  </Tr>
                </Thead>
                <tbody ref={tbodyRef}>
                  {pageFiltered.map((dep) => {
                    const Icon = dependencyCategoryIcon(dep);
                    const active = dep.id === selected?.id;
                    const referenceCount = usageEvidence(dep).length;
                    return (
                      <Tr
                        key={dep.id}
                        onClick={() => setSelectedId(dep.id)}
                        className={cn(
                          "cursor-pointer",
                          active ? "bg-tile-core-bg/40" : "hover:bg-border/10"
                        )}
                      >
                        <Td>
                          <button
                            type="button"
                            onClick={() => setSelectedId(dep.id)}
                            aria-current={active ? "true" : undefined}
                            aria-label={`View ${dep.name} dependency details`}
                            className="flex items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <IconTile icon={Icon} variant="neutral" size="sm" />
                            <span className="font-medium text-foreground">
                              {dep.name}
                            </span>
                          </button>
                        </Td>
                        <Td>
                          <Badge>{SCOPE_LABEL[dep.scope]}</Badge>
                        </Td>
                        <Td className="font-mono text-sm">
                          {dep.declaredVersion ?? "—"}
                        </Td>
                        <Td>
                          <span className="inline-flex items-center gap-1 text-primary">
                            {referenceCount}{" "}
                            {referenceCount === 1 ? "reference" : "references"}{" "}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </span>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              {filtered.length === 0 && (
                <p className="px-6 py-4 text-sm text-muted">
                  {dependencies.length === 0
                    ? "No external dependencies were detected for this repository."
                    : "No dependencies match your search."}
                </p>
              )}
            </Card>

            {filtered.length > pageSize && (
              <Pagination className="mt-4">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    />
                  </PaginationItem>
                  {getPageItems(page, pageCount).map((item, i) =>
                    item === "ellipsis-start" || item === "ellipsis-end" ? (
                      <PaginationItem key={`${item}-${i}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={item === page}
                          onClick={() => setPage(item)}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <PaginationNext
                      disabled={page === pageCount}
                      onClick={() => setPage(page + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </TabsContent>

          <TabsContent value="internal">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              <Link2 className="h-4 w-4" aria-hidden="true" /> How areas connect
            </h2>
            <Card className="p-0">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Area</Th>
                    <Th>Depends on</Th>
                    <Th>Certainty</Th>
                  </Tr>
                </Thead>
                <tbody>
                  {areaRelationships.map((edge) => (
                    <Tr key={`${edge.fromAreaId}->${edge.toAreaId}`}>
                      <Td>
                        <SourceLink
                          location={edge.fromAreaLocation}
                          sourceUrl={areaUrl}
                        >
                          {formatPath(edge.fromAreaName)}
                        </SourceLink>
                      </Td>
                      <Td>
                        <SourceLink
                          location={edge.toAreaLocation}
                          sourceUrl={areaUrl}
                        >
                          {formatPath(edge.toAreaName)}
                        </SourceLink>
                      </Td>
                      <Td>
                        <CertaintyBadge certainty="detected" />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              {areaRelationships.length === 0 && (
                <p className="px-6 py-4 text-sm text-muted">
                  No direct relationships were detected between areas.
                </p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LorePageFrame>
  );
}
