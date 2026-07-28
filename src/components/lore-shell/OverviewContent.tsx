import {
  Compass,
  GitCommitHorizontal,
  Layers,
  Link2,
  TestTube2,
} from "lucide-react";
import type { CertaintyCategory, Lore, SourceLocation } from "@/lore/model";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { IconTile } from "@/components/ui/IconTile";
import { SourceLink } from "@/components/ui/SourceLink";
import { StepList } from "@/components/ui/StepList";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/Table";
import { formatPath } from "@/lib/format-path";

export interface OverviewContentProps {
  lore: Lore;
  sourceUrl?: (location: SourceLocation) => string;
  areaUrl?: (location: SourceLocation) => string;
}

function certaintyLabel(certainty: CertaintyCategory): string {
  return certainty.charAt(0).toUpperCase() + certainty.slice(1);
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
      <div>
        <h1 className="font-serif text-4xl font-semibold text-foreground">
          Overview
        </h1>
        {snapshot.repository.description && (
          <p className="mt-2 text-base text-muted">
            {snapshot.repository.description}
          </p>
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Start Here
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
                        {item.evidence.map((e, i) => (
                          <li key={i}>
                            [{certaintyLabel(e.certainty)}] {e.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ),
              }))}
            />
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Major Areas
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
                  <dt>Depended on by</dt>
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

      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Entry Points
        </h2>
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {lore.entryPoints.map((ep) => (
              <li key={ep.id} className="flex items-center gap-3 px-6 py-3">
                <IconTile icon={Compass} variant="supporting" size="sm" />
                <span className="flex-1 text-sm text-foreground">
                  <span className="font-medium">{ep.kind}</span>{" "}
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

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Link2 className="h-4 w-4" aria-hidden="true" /> Direct Relationships
        </h2>
        <Card className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>From</Th>
                <Th>Kind</Th>
                <Th>To</Th>
                <Th>Certainty</Th>
              </Tr>
            </Thead>
            <tbody>
              {lore.relationships.map((rel) => (
                <Tr key={rel.id}>
                  <Td>
                    <SourceLink
                      location={{ filePath: rel.fromId }}
                      sourceUrl={sourceUrl}
                    />
                  </Td>
                  <Td>{rel.kind}</Td>
                  <Td>
                    <SourceLink
                      location={{ filePath: rel.toId }}
                      sourceUrl={sourceUrl}
                    />
                  </Td>
                  <Td>
                    <CertaintyBadge certainty={rel.certainty} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          {lore.relationships.length === 0 && (
            <p className="px-6 py-4 text-sm text-muted">
              No direct relationships detected.
            </p>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <TestTube2 className="h-4 w-4" aria-hidden="true" /> Test
          Relationships
        </h2>
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {lore.testRelationships.map((tr) => (
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
            {lore.testRelationships.length === 0 && (
              <li className="px-6 py-3 text-sm text-muted">
                No test relationships detected.
              </li>
            )}
          </ul>
        </Card>
      </section>

      <section id="gaps">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
          <GitCommitHorizontal className="h-4 w-4" aria-hidden="true" /> Gaps
        </h2>
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
