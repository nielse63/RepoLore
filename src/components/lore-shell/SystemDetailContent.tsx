import { ReanalyzeButton } from "@/components/ReanalyzeButton";
import { AreaDependencyDiagram } from "@/components/lore-shell/AreaDependencyDiagram";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import { RightRailShell } from "@/components/lore-shell/RightRailShell";
import { TopBar } from "@/components/lore-shell/TopBar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { IconTile } from "@/components/ui/IconTile";
import { SourceLink } from "@/components/ui/SourceLink";
import { githubBlobUrl, githubTreeUrl } from "@/github/urls";
import { relativeTime } from "@/lib/relative-time";
import { formatPath } from "@/lib/format-path";
import { deriveAreaRelationships } from "@/lore/area-relationships";
import type { Lore, SourceLocation } from "@/lore/model";
import {
  classifySystem,
  type SystemClassification,
} from "@/lore/system-classification";
import { findAreaBySlug } from "@/lore/system-slug";
import startCase from "lodash.startcase";
import { ArrowLeftRight, Compass, FolderTree, Target } from "lucide-react";
import { notFound } from "next/navigation";

const BADGE_VARIANT_BY_CLASSIFICATION: Record<
  SystemClassification,
  BadgeVariant
> = {
  "Implementation area": "core",
  "Tests / test support": "supporting",
  "Build/tooling configuration": "neutral",
};

export interface SystemDetailContentProps {
  owner: string;
  repo: string;
  lore: Lore;
  areaSlug: string;
}

/**
 * Real Systems subview (ADR-0014): responsibilities, ownership,
 * relationships (filtered to this area's direct neighborhood via the
 * existing, unmodified `AreaDependencyDiagram`), entry points, and evidence
 * for one Major Area — all already-computed data, no new analyzer
 * capability. The mockup's separate Responsibilities/Relationships tabs are
 * collapsed into this one Overview view rather than separate routes; its
 * "Appears in these flows" section and the Evidence panel's "Graph" sub-tab
 * are dropped, not deferred (see the ADR's Decision item 4).
 */
export function SystemDetailContent({
  owner,
  repo,
  lore,
  areaSlug,
}: SystemDetailContentProps) {
  const majorAreas = lore.structuralAreas.filter((area) => area.name !== ".");
  const area = findAreaBySlug(majorAreas, areaSlug);
  if (!area) notFound();

  const commitSha = lore.snapshot.commitSha;
  const sourceUrl = (location: SourceLocation) =>
    githubBlobUrl(owner, repo, commitSha, location);
  const areaUrl = (location: SourceLocation) =>
    githubTreeUrl(owner, repo, commitSha, location);

  const allRelationships = deriveAreaRelationships(majorAreas);
  const neighborIds = new Set([
    area.id,
    ...area.directDependencyIds,
    ...area.directDependentIds,
  ]);
  const neighborAreas = majorAreas.filter((a) => neighborIds.has(a.id));
  const neighborRelationships = allRelationships.filter(
    (edge) => neighborIds.has(edge.fromAreaId) && neighborIds.has(edge.toAreaId)
  );

  const entryPoints = lore.entryPoints.filter((ep) =>
    area.entryPointIds.includes(ep.id)
  );

  const base = `/lore/${owner}/${repo}`;
  const classification = classifySystem(area);

  return (
    <LorePageFrame
      topBar={
        <TopBar
          left={
            <Breadcrumbs
              items={[
                { label: "Systems", href: `${base}/systems` },
                { label: formatPath(area.name) },
              ]}
            />
          }
          actions={<ReanalyzeButton owner={owner} repo={repo} />}
        />
      }
      rightRail={
        <RightRailShell title="Evidence">
          <p className="text-sm text-muted">
            {area.evidence.length}{" "}
            {area.evidence.length === 1 ? "reference" : "references"} · Last
            verified {relativeTime(lore.snapshot.analyzedAt)}
          </p>
          <ul className="mt-4 space-y-3 text-sm">
            {area.evidence.map((evidence, i) => (
              <li key={i}>
                <div className="flex items-center gap-2">
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
                No evidence was recorded for this system.
              </li>
            )}
          </ul>
        </RightRailShell>
      }
    >
      <div className="max-w-4xl">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-4xl font-semibold text-foreground">
            {formatPath(area.name)}
          </h1>
          <Badge variant={BADGE_VARIANT_BY_CLASSIFICATION[classification]}>
            {classification}
          </Badge>
        </div>
        <p className="mt-2 text-base text-muted">
          {area.responsibility ?? area.rationale}
        </p>

        <div className="mt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <div className="flex items-start gap-3">
                <IconTile icon={Target} variant="core" size="sm" />
                <div>
                  <CardTitle>Responsibilities</CardTitle>
                  <CardDescription>
                    Evidence-backed statements about what this system does.
                  </CardDescription>
                </div>
              </div>
              <p className="mt-4 text-sm text-foreground">
                {area.responsibility ??
                  "No specific responsibility was distinguished for this system beyond its structural grouping."}
              </p>
              <p className="mt-2 text-sm text-muted">{area.rationale}</p>
            </Card>
            <Card>
              <div className="flex items-start gap-3">
                <IconTile icon={FolderTree} variant="data" size="sm" />
                <div>
                  <CardTitle>Owns</CardTitle>
                  <CardDescription>
                    Source locations grouped under this system.
                  </CardDescription>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <SourceLink location={area.location} sourceUrl={areaUrl}>
                    {formatPath(area.name)}
                  </SourceLink>
                </li>
                {area.importantLocations.map((location, i) => (
                  <li key={i}>
                    <SourceLink location={location} sourceUrl={sourceUrl} />
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <div className="flex items-start gap-3">
              <IconTile icon={ArrowLeftRight} variant="supporting" size="sm" />
              <div>
                <CardTitle>Relationships</CardTitle>
                <CardDescription>
                  How this system directly depends on, and is depended on by,
                  other systems.
                </CardDescription>
              </div>
            </div>
            {neighborAreas.length > 1 ? (
              <div className="mt-4">
                <AreaDependencyDiagram
                  areas={neighborAreas}
                  relationships={neighborRelationships}
                  areaUrl={areaUrl}
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">
                No direct relationships were detected for this system.
              </p>
            )}
          </Card>

          {entryPoints.length > 0 && (
            <Card className="p-0">
              <div className="flex items-start gap-3 p-6 pb-0">
                <IconTile icon={Compass} variant="core" size="sm" />
                <div>
                  <CardTitle>Key entry points</CardTitle>
                  <CardDescription>
                    Probable entry points located within this system.
                  </CardDescription>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-border">
                {entryPoints.map((ep) => (
                  <li key={ep.id} className="flex items-center gap-3 px-6 py-3">
                    <span className="flex-1 text-sm text-foreground">
                      <span className="font-medium">{startCase(ep.kind)}</span>{" "}
                      <SourceLink
                        location={ep.location}
                        sourceUrl={sourceUrl}
                      />
                    </span>
                    <CertaintyBadge certainty={ep.certainty} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </LorePageFrame>
  );
}
