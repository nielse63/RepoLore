import { formatPath } from "@/lib/format-path";
import { deriveAreaDiagramLayout } from "@/lore/area-diagram-layout";
import type { AreaRelationship } from "@/lore/area-relationships";
import type { SourceLocation, StructuralArea } from "@/lore/model";
import type { HTMLAttributes } from "react";

// SVG's <foreignObject> requires its HTML content to declare the XHTML
// namespace explicitly; React's HTML element types don't model `xmlns`, so
// it's cast in rather than typed as a first-class prop.
const XHTML_NAMESPACE = {
  xmlns: "http://www.w3.org/1999/xhtml",
} as HTMLAttributes<HTMLDivElement>;

export interface AreaDependencyDiagramProps {
  areas: StructuralArea[];
  relationships: AreaRelationship[];
  areaUrl?: (location: SourceLocation) => string;
}

/**
 * Maps `StructuralArea.responsibility` — a closed, known vocabulary set by
 * `derive-views.ts` (`"Tests"`, `"Test fixtures/support data"`,
 * `"Build/tooling configuration"`) and JS/TS's React detector
 * (`"Presentational React components"`) — to one of the design system's
 * existing tile color tokens, reusing `IconTile`'s variant palette rather
 * than inventing new colors. An area with no special `responsibility` (the
 * ordinary case) gets the default "implementation area" color. Unrecognized
 * future responsibility strings fall back to the same default rather than
 * going unstyled.
 */
type ResponsibilityVariant = "core" | "supporting" | "data" | "neutral";

const DEFAULT_RESPONSIBILITY_STYLE = {
  variant: "core" as ResponsibilityVariant,
  legendLabel: "Implementation area",
};

const RESPONSIBILITY_STYLES: Record<
  string,
  { variant: ResponsibilityVariant; legendLabel: string }
> = {
  Tests: { variant: "supporting", legendLabel: "Tests / test support" },
  "Test fixtures/support data": {
    variant: "supporting",
    legendLabel: "Tests / test support",
  },
  "Build/tooling configuration": {
    variant: "neutral",
    legendLabel: "Build/tooling configuration",
  },
  "Presentational React components": {
    variant: "data",
    legendLabel: "Presentational React components",
  },
};

const VARIANT_CLASSES: Record<
  ResponsibilityVariant,
  { bg: string; fg: string; swatch: string }
> = {
  core: {
    bg: "bg-tile-core-bg",
    fg: "text-tile-core-fg",
    swatch: "bg-tile-core-bg",
  },
  supporting: {
    bg: "bg-tile-supporting-bg",
    fg: "text-tile-supporting-fg",
    swatch: "bg-tile-supporting-bg",
  },
  data: {
    bg: "bg-tile-data-bg",
    fg: "text-tile-data-fg",
    swatch: "bg-tile-data-bg",
  },
  neutral: {
    bg: "bg-border/60",
    fg: "text-foreground",
    swatch: "bg-border",
  },
};

function responsibilityStyle(responsibility?: string) {
  if (!responsibility) return DEFAULT_RESPONSIBILITY_STYLE;
  return RESPONSIBILITY_STYLES[responsibility] ?? DEFAULT_RESPONSIBILITY_STYLE;
}

/**
 * A static, non-interactive box-and-arrow diagram of Major-Area-to-Major-
 * Area dependencies — a deliberate, scoped exception to the MVP's
 * plain-lists-and-tables default (see ADR-0009). Node positions/edge
 * routing come from `@dagrejs/dagre`, used for layout only: no pan, zoom,
 * drag, or click-to-filter, and no new relationship data beyond what
 * `deriveAreaRelationships` already produces for the "Component Connections"
 * table. Renders nothing when there isn't a meaningful diagram to draw
 * (too few or too many areas — see `deriveAreaDiagramLayout`). Each node is
 * colored by its `responsibility` (see `responsibilityStyle`) rather than
 * captioned with it as text, with a legend below the diagram explaining the
 * colors actually in use.
 */
export function AreaDependencyDiagram({
  areas,
  relationships,
  areaUrl,
}: AreaDependencyDiagramProps) {
  const layout = deriveAreaDiagramLayout(areas, relationships);
  if (!layout) return null;

  // Tripled uniformly (not just height) so nodes actually render larger
  // rather than being centered in extra empty space: scaling only the
  // height while width stays container-fit wouldn't enlarge anything,
  // since the SVG would still be scaled-to-fit by the unchanged width.
  const DISPLAY_SCALE = 1;

  const legendEntries = Array.from(
    new Map(
      layout.nodes.map((node) => {
        const style = responsibilityStyle(node.responsibility);
        return [
          style.legendLabel,
          {
            legendLabel: style.legendLabel,
            swatch: VARIANT_CLASSES[style.variant].swatch,
          },
        ];
      })
    ).values()
  );

  return (
    <div id="area-dependency-diagram">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width * DISPLAY_SCALE}
          height={layout.height * DISPLAY_SCALE}
          className="h-auto w-auto max-h-dvh"
          role="img"
          aria-label="Diagram of how major areas depend on each other"
          id="area-dependency-diagram-svg"
        >
          <defs>
            <marker
              id="area-diagram-arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill="var(--border)" />
            </marker>
          </defs>

          {layout.edges.map((edge) => (
            <path
              key={`${edge.fromId}->${edge.toId}`}
              d={edge.points
                .map(
                  (point, i) => `${i === 0 ? "M" : "L"}${point.x},${point.y}`
                )
                .join(" ")}
              stroke="var(--border)"
              strokeWidth={1.5}
              fill="none"
              markerEnd="url(#area-diagram-arrowhead)"
            />
          ))}

          {layout.nodes.map((node) => {
            const style =
              VARIANT_CLASSES[responsibilityStyle(node.responsibility).variant];
            return (
              <foreignObject
                key={node.id}
                x={node.x}
                y={node.y}
                width={node.width / DISPLAY_SCALE}
                height={node.height / DISPLAY_SCALE}
              >
                <div
                  {...XHTML_NAMESPACE}
                  className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-border px-3 py-2 text-center ${style.bg}`}
                >
                  {areaUrl ? (
                    <a
                      href={areaUrl(node.location)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full truncate text-xs font-medium hover:underline ${style.fg}`}
                    >
                      {formatPath(node.name)}
                    </a>
                  ) : (
                    <span
                      className={`w-full truncate text-xs font-medium ${style.fg}`}
                    >
                      {formatPath(node.name)}
                    </span>
                  )}
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
      {legendEntries.length > 1 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {legendEntries.map((entry) => (
            <li
              key={entry.legendLabel}
              className="flex items-center gap-1.5 text-xs text-muted"
            >
              <span
                className={`h-2.5 w-2.5 rounded-sm ${entry.swatch}`}
                aria-hidden="true"
              />
              {entry.legendLabel}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
