import { AreaDependencyDiagram } from "@/components/lore-shell/AreaDependencyDiagram";
import { GapsList } from "@/components/lore-shell/GapsList";
import { PaginatedList } from "@/components/lore-shell/PaginatedList";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { IconTile } from "@/components/ui/IconTile";
import { SourceLink } from "@/components/ui/SourceLink";
import { Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { formatPath } from "@/lib/format-path";
import { listItemKey } from "@/lib/list-item-key";
import { deriveAreaDiagramLayout } from "@/lore/area-diagram-layout";
import { deriveAreaRelationships } from "@/lore/area-relationships";
import type { Lore, SourceLocation } from "@/lore/model";
import startCase from "lodash.startcase";
import { Compass, GapHorizontal, Layers, Link2, TestTube2 } from "lucide-react";

export interface ArchitectureContentProps {
  lore: Lore;
  repo: string;
  sourceUrl?: (location: SourceLocation) => string;
  areaUrl?: (location: SourceLocation) => string;
}

/**
 * Real Architecture view (ADR-0008): Major Areas, the direct relationships
 * between them (derived from data `derive-views.ts` already computes — no
 * new analyzer capability), and Entry Points, grouped per detected project.
 * Deliberately no infrastructure/data-store detection, expanded framework
 * detection, or "architectural boundaries" narrative claims — see the ADR
 * for why each was rejected for this version. The area-to-area relationship
 * diagram is a later, narrowly scoped exception to that ADR's "no diagram"
 * decision — see ADR-0009.
 */
export function ArchitectureContent({
  lore,
  repo,
  sourceUrl,
  areaUrl = sourceUrl,
}: ArchitectureContentProps) {
  const areaRelationships = deriveAreaRelationships(lore.structuralAreas);
  // The root directory ("." — a file with no directory of its own) adds no
  // orientation value as a diagram node, matching the Major Areas exclusion
  // above.
  const majorAreas = lore.structuralAreas.filter((area) => area.name !== ".");
  const diagramLayout = deriveAreaDiagramLayout(majorAreas, areaRelationships);

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <div>
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Architecture
        </h1>
        <p className="mt-2 text-base text-muted">
          How the major parts of this repository work together.
        </p>
      </div>

      {lore.projects.map((project) => {
        // The root directory ("." — a file with no directory of its own, e.g.
        // a root-level config file) adds no orientation value as its own
        // Major Area.
        const projectAreas = lore.structuralAreas.filter(
          (area) => area.projectId === project.id && area.name !== "."
        );
        // A single-project repo's `project.name` falls back to the
        // extraction directory's basename when `package.json` has no
        // `"name"` — always the internal literal "source"
        // (`extract-tarball.ts`), not a name worth surfacing. The repo name
        // is meaningful in every case; the package name only adds
        // information when there's more than one project to distinguish.
        const projectLabel = lore.projects.length > 1 ? project.name : repo;
        return (
          <section key={project.id} className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-foreground font-mono">
              {projectLabel}
            </h2>

            <Card>
              <div className="flex items-start gap-3">
                <IconTile icon={Layers} variant="core" size="sm" />
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    <SourceLink
                      location={{ filePath: project.rootPath }}
                      sourceUrl={areaUrl}
                    >
                      {projectLabel}
                    </SourceLink>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {startCase(project.kind)}
                  </CardDescription>
                </div>
              </div>
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted">
                <div>
                  <dt>Languages</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {project.languages.length > 0 ? (
                      project.languages.map((lang, i) => (
                        <Badge key={listItemKey(i)}>{lang}</Badge>
                      ))
                    ) : (
                      <span className="text-foreground">None detected</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Frameworks</dt>
                  <dd className="mt-1 flex flex-wrap gap-1">
                    {project.frameworks.length > 0 ? (
                      project.frameworks.map((fw, i) => (
                        <Badge key={listItemKey(i)}>{fw}</Badge>
                      ))
                    ) : (
                      <span className="text-foreground">None detected</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
                <Layers className="h-4 w-4" aria-hidden="true" /> Major Areas
              </h3>
              <Card className="p-0">
                <ul className="divide-y divide-border">
                  {projectAreas.map((area) => (
                    <li
                      key={area.id}
                      className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <SourceLink
                          location={area.location}
                          sourceUrl={areaUrl}
                        >
                          {formatPath(area.name)}
                        </SourceLink>
                        <p className="mt-1 text-sm text-muted">
                          {area.responsibility ?? area.rationale}
                        </p>
                      </div>
                      <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                        <div>
                          <dt>Entry points</dt>
                          <dd className="mt-0.5 text-sm font-medium text-foreground">
                            {area.entryPointIds.length}
                          </dd>
                        </div>
                        <div>
                          <dt>Depends on</dt>
                          <dd className="mt-0.5 text-sm font-medium text-foreground">
                            {area.directDependencyIds.length}
                          </dd>
                        </div>
                        <div>
                          <dt>Imported By</dt>
                          <dd className="mt-0.5 text-sm font-medium text-foreground">
                            {area.directDependentIds.length}
                          </dd>
                        </div>
                        <div>
                          <dt>Evidence</dt>
                          <dd className="mt-0.5 text-sm font-medium text-foreground">
                            {area.evidence.length}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                  {projectAreas.length === 0 && (
                    <li className="px-6 py-4 text-sm text-muted">
                      No structural areas detected for this project.
                    </li>
                  )}
                </ul>
              </Card>
            </div>
          </section>
        );
      })}
      {lore.projects.length === 0 && (
        <p className="text-sm text-muted">
          No projects were detected for this repository.
        </p>
      )}

      <section id="component-connections">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Link2 className="h-4 w-4" aria-hidden="true" /> Component Connections
        </h2>
        {diagramLayout && (
          <Card className="mb-4">
            <AreaDependencyDiagram
              areas={majorAreas}
              relationships={areaRelationships}
              owner={lore.snapshot.repository.owner}
              repo={repo}
              commitSha={lore.snapshot.commitSha}
            />
          </Card>
        )}
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
      </section>

      {!!lore.entryPoints.length && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Compass className="h-4 w-4" aria-hidden="true" /> Entry Points
          </h2>
          <PaginatedList
            items={lore.entryPoints.map((ep) => (
              <li key={ep.id} className="flex items-center gap-3 px-6 py-3">
                <span className="flex-1 text-sm text-foreground">
                  <span className="font-medium">{startCase(ep.kind)}</span>{" "}
                  <SourceLink location={ep.location} sourceUrl={sourceUrl} />
                </span>
                <CertaintyBadge certainty={ep.certainty} />
              </li>
            ))}
            storageKey={`entry-points-page:${lore.snapshot.repository.owner}/${lore.snapshot.repository.name}:architecture`}
            emptyState={
              <li className="px-6 py-3 text-sm text-muted">
                No entry points detected.
              </li>
            }
          />
        </section>
      )}

      {!!lore.gaps.length && (
        <section id="gaps">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
            <GapHorizontal className="h-4 w-4" aria-hidden="true" /> Gaps
          </h2>
          <GapsList
            gaps={lore.gaps}
            storageKey={`gaps-page:${lore.snapshot.repository.owner}/${lore.snapshot.repository.name}:architecture`}
          />
        </section>
      )}

      <section id="test-relationships">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <TestTube2 className="h-4 w-4" aria-hidden="true" /> Test
          Relationships
        </h2>
        <PaginatedList
          items={lore.testRelationships.map((tr) => (
            <li
              key={tr.id}
              className="flex flex-wrap items-center gap-2 px-6 py-3 text-sm"
            >
              <CertaintyBadge certainty={tr.certainty} />
              <SourceLink location={tr.testLocation} sourceUrl={sourceUrl} />
              <span className="text-muted">tests</span>
              <SourceLink
                location={tr.implementationLocation}
                sourceUrl={sourceUrl}
              />
            </li>
          ))}
          storageKey={`test-relationships-page:${lore.snapshot.repository.owner}/${lore.snapshot.repository.name}:architecture`}
          emptyState={
            <li className="px-6 py-3 text-sm text-muted">
              No test relationships detected.
            </li>
          }
        />
      </section>
    </div>
  );
}
