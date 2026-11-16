"use client";

import {
  LoreInspector,
  type Inspector,
} from "@/components/lore-shell/LoreInspector";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { SourceLink } from "@/components/ui/SourceLink";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import { formatPath } from "@/lib/format-path";
import { listItemKey } from "@/lib/list-item-key";
import type { AreaRelationship } from "@/lore/area-relationships";
import type { EntityId, SourceLocation, StructuralArea } from "@/lore/model";
import { ExternalLink } from "lucide-react";

function RelatedAreas({
  heading,
  areas,
  shownIds,
}: {
  heading: string;
  areas: StructuralArea[];
  shownIds: Set<EntityId>;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-sm font-semibold text-foreground">
        {heading}{" "}
        <span className="font-normal text-muted">({areas.length})</span>
      </h3>
      {areas.length > 0 ? (
        <ul aria-label={heading} className="mt-2 space-y-1 text-sm">
          {areas.map((area) => (
            <li key={area.id}>
              <span className="font-mono text-foreground">
                {formatPath(area.name)}
              </span>
              {!shownIds.has(area.id) && (
                <span className="text-xs text-muted"> · not on the map</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">None detected.</p>
      )}
    </section>
  );
}

/**
 * The inspector for an area selected on `AreaDependencyDiagram` (GitHub
 * issue #79): its role, its GitHub location (moved here from the node
 * label, so selecting a node never competes with a link), what it imports
 * and what imports it, and its evidence. The import lists come from the
 * same production-only area relationships the map's arrows do, over every
 * area rather than just the drawn subset, so a neighbor the map leaves out
 * is listed and marked rather than silently dropped.
 */
export function AreaInspector({
  inspector,
  area,
  areas,
  relationships,
  shownIds,
  owner,
  repo,
  commitSha,
}: {
  inspector: Inspector<EntityId>;
  area: StructuralArea;
  areas: StructuralArea[];
  relationships: AreaRelationship[];
  shownIds: Set<EntityId>;
  owner: string;
  repo: string;
  commitSha: string;
}) {
  const areaById = new Map(areas.map((candidate) => [candidate.id, candidate]));
  const related = (ids: EntityId[]) =>
    ids.flatMap((id) => areaById.get(id) ?? []);
  const imports = related(
    relationships
      .filter((rel) => rel.fromAreaId === area.id)
      .map((rel) => rel.toAreaId)
  );
  const importers = related(
    relationships
      .filter((rel) => rel.toAreaId === area.id)
      .map((rel) => rel.fromAreaId)
  );
  const sourceUrl = (location: SourceLocation) =>
    githubBlobUrl(owner, repo, commitSha, location);

  return (
    <LoreInspector
      inspector={inspector}
      kind="Area evidence"
      title={formatPath(area.name)}
    >
      <p className="text-sm text-foreground">
        {area.responsibility ?? area.rationale}
      </p>
      {area.responsibility && (
        <p className="mt-1 text-sm text-muted">{area.rationale}</p>
      )}
      <a
        href={githubTreeUrl(owner, repo, commitSha, area.location)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        View on GitHub
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>

      <RelatedAreas heading="Imports" areas={imports} shownIds={shownIds} />
      <RelatedAreas
        heading="Imported by"
        areas={importers}
        shownIds={shownIds}
      />
      <p className="mt-3 text-xs text-muted">
        Imports between production source files resolved to a file in this
        repository; unresolved or dynamic imports are Unknown.
      </p>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-foreground">
          Evidence{" "}
          <span className="font-normal text-muted">
            ({area.evidence.length})
          </span>
        </h3>
        <ul className="mt-2 space-y-3 text-sm">
          {area.evidence.map((evidence, i) => (
            <li key={listItemKey(i)}>
              <div className="flex flex-wrap items-center gap-2">
                {evidence.location && (
                  <SourceLink
                    location={evidence.location}
                    sourceUrl={sourceUrl}
                  />
                )}
                <CertaintyBadge certainty={evidence.certainty} />
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {evidence.description}
              </p>
            </li>
          ))}
          {area.evidence.length === 0 && (
            <li className="text-sm text-muted">
              No evidence was recorded for this area.
            </li>
          )}
        </ul>
      </section>
    </LoreInspector>
  );
}
