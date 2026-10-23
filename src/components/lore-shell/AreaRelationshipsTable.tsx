import { PaginatedTable } from "@/components/lore-shell/PaginatedTable";
import { CertaintyBadge } from "@/components/ui/CertaintyBadge";
import { SourceLink } from "@/components/ui/SourceLink";
import { Td, Th, Thead, Tr } from "@/components/ui/Table";
import { formatPath } from "@/lib/format-path";
import type { AreaRelationship } from "@/lore/area-relationships";
import type { SourceLocation } from "@/lore/model";

/**
 * Area → "Depends on" table shared by Architecture's Component Connections
 * and Dependencies' internal tab, paginated (see `PaginatedTable`) with the
 * page remembered per `storageKey`. Every edge is `detected` (see
 * `deriveAreaRelationships`), so certainty is constant per row.
 */
export function AreaRelationshipsTable({
  relationships,
  areaUrl,
  storageKey,
}: {
  relationships: AreaRelationship[];
  areaUrl?: (location: SourceLocation) => string;
  storageKey: string;
}) {
  return (
    <PaginatedTable
      head={
        <Thead>
          <Tr>
            <Th>Area</Th>
            <Th>Depends on</Th>
            <Th>Certainty</Th>
          </Tr>
        </Thead>
      }
      rows={relationships.map((edge) => (
        <Tr key={`${edge.fromAreaId}->${edge.toAreaId}`}>
          <Td>
            <SourceLink location={edge.fromAreaLocation} sourceUrl={areaUrl}>
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
      storageKey={storageKey}
      emptyState={
        <p className="px-6 py-4 text-sm text-muted">
          No direct relationships were detected between areas.
        </p>
      }
    />
  );
}
