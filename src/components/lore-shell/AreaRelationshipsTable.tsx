import { Card } from "@/components/ui/Card";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { SourceLink } from "@/components/ui/SourceLink";
import { Table, Td, Th, Thead, Tr } from "@/components/ui/Table";
import { formatPath } from "@/lib/format-path";
import type { AreaRelationship } from "@/lore/area-relationships";
import type { SourceLocation } from "@/lore/model";

/**
 * Area → "Depends on" table shared by Architecture's Component Connections
 * and Dependencies' internal tab. Every edge is `detected` (see
 * `deriveAreaRelationships`), so certainty is constant per row.
 */
export function AreaRelationshipsTable({
  relationships,
  areaUrl,
}: {
  relationships: AreaRelationship[];
  areaUrl?: (location: SourceLocation) => string;
}) {
  return (
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
          {relationships.map((edge) => (
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
                <SourceLink location={edge.toAreaLocation} sourceUrl={areaUrl}>
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
      {relationships.length === 0 && (
        <p className="px-6 py-4 text-sm text-muted">
          No direct relationships were detected between areas.
        </p>
      )}
    </Card>
  );
}
