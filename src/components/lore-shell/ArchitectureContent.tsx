import { Compass, Layers, Link2 } from "lucide-react";
import startCase from "lodash.startcase";
import type { Lore, SourceLocation } from "@/lore/model";
import { deriveAreaRelationships } from "@/lore/area-relationships";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { IconTile } from "@/components/ui/IconTile";
import { SourceLink } from "@/components/ui/SourceLink";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { formatPath } from "@/lib/format-path";

export interface ArchitectureContentProps {
  lore: Lore;
  sourceUrl?: (location: SourceLocation) => string;
  areaUrl?: (location: SourceLocation) => string;
}

/**
 * Real Architecture view (ADR-0008): Major Areas, the direct relationships
 * between them (derived from data `derive-views.ts` already computes — no
 * new analyzer capability), and Entry Points, grouped per detected project.
 * Deliberately no diagram, infrastructure/data-store detection, expanded
 * framework detection, or "architectural boundaries" narrative claims — see
 * the ADR for why each was rejected for this version.
 */
export function ArchitectureContent({
  lore,
  sourceUrl,
  areaUrl = sourceUrl,
}: ArchitectureContentProps) {
  const areaRelationships = deriveAreaRelationships(lore.structuralAreas);

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
        return (
          <section key={project.id} className="flex flex-col gap-6">
            {lore.projects.length > 1 && (
              <h2 className="text-lg font-semibold text-foreground">
                {project.name}
              </h2>
            )}

            <Card>
              <div className="flex items-start gap-3">
                <IconTile icon={Layers} variant="core" size="sm" />
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    <SourceLink
                      location={{ filePath: project.rootPath }}
                      sourceUrl={areaUrl}
                    >
                      {project.name}
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
                      project.languages.map((lang) => (
                        <Badge key={lang}>{lang}</Badge>
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
                      project.frameworks.map((fw) => (
                        <Badge key={fw}>{fw}</Badge>
                      ))
                    ) : (
                      <span className="text-foreground">None detected</span>
                    )}
                  </dd>
                </div>
              </dl>
            </Card>

            <div>
              <h3 className="mb-3 text-base font-semibold text-foreground">
                Major Areas
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
                          <dt>Depended on by</dt>
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

      <section>
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
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Compass className="h-4 w-4" aria-hidden="true" /> Entry Points
        </h2>
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {lore.entryPoints.map((ep) => (
              <li key={ep.id} className="flex items-center gap-3 px-6 py-3">
                <span className="flex-1 text-sm text-foreground">
                  <span className="font-medium">{startCase(ep.kind)}</span>{" "}
                  <SourceLink location={ep.location} sourceUrl={sourceUrl} />
                </span>
                <CertaintyBadge certainty={ep.certainty} />
              </li>
            ))}
            {lore.entryPoints.length === 0 && (
              <li className="px-6 py-3 text-sm text-muted">
                No entry points detected.
              </li>
            )}
          </ul>
        </Card>
      </section>

      <section id="gaps">
        <h2 className="mb-3 text-lg font-semibold text-foreground">Gaps</h2>
        {lore.gaps.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {lore.gaps.map((gap, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 px-6 py-3 text-sm"
                >
                  <CertaintyBadge certainty={gap.certainty} />
                  <span className="text-foreground">{gap.description}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
