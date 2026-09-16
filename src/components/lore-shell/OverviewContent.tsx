import { GapsList } from "@/components/lore-shell/GapsList";
import { PaginatedList } from "@/components/lore-shell/PaginatedList";
import { PartialUnderstandingCard } from "@/components/lore-shell/PartialUnderstandingCard";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import {
  CertaintyBadge,
  VARIANT_BY_CERTAINTY,
} from "@/components/ui/CertaintyBadge";
import { IconTile } from "@/components/ui/IconTile";
import { SourceLink } from "@/components/ui/SourceLink";
import { StepList } from "@/components/ui/StepList";
import { formatPath } from "@/lib/format-path";
import type { CertaintyCategory, Lore, SourceLocation } from "@/lore/model";
import { Compass, GapHorizontal, Layers, Milestone } from "lucide-react";

export interface OverviewContentProps {
  lore: Lore;
  sourceUrl?: (location: SourceLocation) => string;
  areaUrl?: (location: SourceLocation) => string;
}

function certaintyLabel(certainty: CertaintyCategory): string {
  return certainty.charAt(0).toUpperCase() + certainty.slice(1);
}

function getCertaintyColor(certainty: CertaintyCategory): string {
  if (certainty in VARIANT_BY_CERTAINTY) {
    return `text-tile-${VARIANT_BY_CERTAINTY[certainty]}-fg`;
  }
  return "";
}

export function OverviewContent({
  lore,
  sourceUrl,
  areaUrl = sourceUrl,
}: OverviewContentProps) {
  const { snapshot } = lore;

  const areaFilePaths = new Set(
    lore.structuralAreas.map((area) => area.location.filePath)
  );
  const startHereUrl = (location: SourceLocation) =>
    areaFilePaths.has(location.filePath) ? areaUrl : sourceUrl;
  // The root directory ("." — a file with no directory of its own, e.g. a
  // root-level config file) adds no orientation value as its own Major Area.
  const majorAreas = lore.structuralAreas.filter((area) => area.name !== ".");

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <section id="overview-header">
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Overview
        </h1>
        {snapshot.repository.description && (
          <p className="mt-2 text-base text-muted">
            {snapshot.repository.description}
          </p>
        )}
      </section>

      {snapshot.status !== "completed" && (
        <PartialUnderstandingCard gapsCount={lore.gaps.length} />
      )}

      <section id="start-here">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Milestone className="h-4 w-4" aria-hidden="true" /> Start Here
        </h2>
        <Card>
          {lore.startHere.length === 0 ? (
            <p className="text-sm text-muted">
              No Start Here path could be established.
            </p>
          ) : (
            <StepList
              steps={lore.startHere.map((item) => ({
                id: item.id,
                title: (
                  <span className="flex flex-wrap items-center gap-2">
                    <SourceLink
                      location={item.location}
                      sourceUrl={startHereUrl(item.location)}
                    />
                    <span className="font-normal text-muted">
                      — {item.whatItRepresents}
                    </span>
                  </span>
                ),
                meta: <CertaintyBadge certainty={item.certainty} />,
                description: (
                  <>
                    <p>{item.rationale}</p>
                    {item.evidence.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted">
                        {item.evidence.map((e, i) => {
                          return (
                            <li key={i}>
                              <span className={getCertaintyColor(e.certainty)}>
                                [{certaintyLabel(e.certainty)}]
                              </span>{" "}
                              {e.description}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                ),
              }))}
            />
          )}
        </Card>
      </section>

      <section id="major-areas">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Layers className="h-4 w-4" aria-hidden="true" /> Major Areas
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {majorAreas.map((area) => (
            <Card key={area.id}>
              <div className="flex items-start gap-3">
                <IconTile icon={Layers} variant="core" size="sm" />
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    <SourceLink location={area.location} sourceUrl={areaUrl}>
                      {formatPath(area.name)}
                    </SourceLink>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {area.responsibility ?? area.rationale}
                  </CardDescription>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-2 text-xs text-muted sm:grid-cols-4">
                <div>
                  <dt>Entry points</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {area.entryPointIds.length}
                  </dd>
                </div>
                <div>
                  <dt>Depends on</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {area.directDependencyIds.length}
                  </dd>
                </div>
                <div>
                  <dt>Imported By</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {area.directDependentIds.length}
                  </dd>
                </div>
                <div>
                  <dt>Tests</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {area.testRelationshipIds.length}
                  </dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
      </section>

      {!!lore.entryPoints.length && (
        <section id="entry-points">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Compass className="h-4 w-4" aria-hidden="true" /> Entry Points
          </h2>
          <PaginatedList
            items={lore.entryPoints.map((ep) => (
              <li key={ep.id} className="flex items-center gap-3 px-6 py-3">
                <IconTile icon={Compass} variant="supporting" size="sm" />
                <span className="flex-1 text-sm text-foreground">
                  <span className="font-medium">{ep.kind}</span>{" "}
                  <SourceLink location={ep.location} sourceUrl={sourceUrl} />
                </span>
                <CertaintyBadge certainty={ep.certainty} />
              </li>
            ))}
            storageKey={`entry-points-page:${snapshot.repository.owner}/${snapshot.repository.name}:overview`}
            emptyState={
              <li className="px-6 py-3 text-sm text-muted">
                No entry points detected.
              </li>
            }
          />
        </section>
      )}

      <section id="gaps">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <GapHorizontal className="h-4 w-4" aria-hidden="true" /> Gaps
        </h2>
        <GapsList
          gaps={lore.gaps}
          storageKey={`gaps-page:${snapshot.repository.owner}/${snapshot.repository.name}:overview`}
        />
      </section>
    </div>
  );
}
