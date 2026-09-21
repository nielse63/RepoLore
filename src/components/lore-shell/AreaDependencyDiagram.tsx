"use client";

import { githubTreeUrl } from "@/github/urls";
import { formatPath } from "@/lib/format-path";
import { deriveProductionAreaDiagramLayout } from "@/lore/area-diagram-layout";
import type { Relationship, StructuralArea } from "@/lore/model";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

type ResponsibilityVariant = "core" | "supporting" | "data" | "neutral";

const DEFAULT_RESPONSIBILITY_STYLE = {
  variant: "core" as ResponsibilityVariant,
  legendLabel: "Implementation area",
};

/**
 * Labels reused verbatim from `classifySystem` (`src/lore/system-classification.ts`)
 * and the Systems page — "Implementation area" / "Tests / test support" /
 * "Build/tooling configuration" — never a criticality/importance-sounding
 * label like "Core" or "Primary", per the `product-scope-guardian` guardrail
 * ADR-0014 recorded against `non-goals.md`'s "no generalized health
 * findings" line. Keep this vocabulary and `classifySystem`'s in sync.
 */
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

interface AreaNodeData extends Record<string, unknown> {
  name: string;
  responsibility?: string;
  href?: string;
}

function AreaNode({ data }: NodeProps<Node<AreaNodeData>>) {
  const style =
    VARIANT_CLASSES[responsibilityStyle(data.responsibility).variant];
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-border px-3 py-2 text-center ${style.bg}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-border" />
      {data.href ? (
        <a
          href={data.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full truncate text-xs font-medium hover:underline ${style.fg}`}
        >
          {formatPath(data.name)}
        </a>
      ) : (
        <span className={`w-full truncate text-xs font-medium ${style.fg}`}>
          {formatPath(data.name)}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-border" />
    </div>
  );
}

const NODE_TYPES = { areaNode: AreaNode };

export interface AreaDependencyDiagramProps {
  areas: StructuralArea[];
  // Raw file-level relationships (`lore.relationships`), not the already
  // area-rolled-up `AreaRelationship[]` — this diagram derives its own
  // production-only area edges from these via
  // `deriveProductionAreaRelationships`, excluding test files. Other views
  // of the same area relationships (e.g. the "Component Connections" table)
  // keep using the full, test-inclusive `deriveAreaRelationships` output.
  relationships: Relationship[];
  // A client component can't accept a function prop from a server
  // component (RSC serialization boundary), so this takes plain data and
  // builds each node's GitHub URL itself via `githubTreeUrl`, rather than
  // the callback-style `areaUrl?: (location) => string` other lore-shell
  // components use.
  owner: string;
  repo: string;
  commitSha: string;
}

/**
 * Renders the area dependency diagram client-side with `@xyflow/react`
 * (react-flow), per ADR-0016, which narrowly amends ADR-0009's original
 * "static, non-interactive" decision to allow pan/zoom/`fitView` once the
 * product owner found larger diagrams didn't fit the fixed viewport. Node
 * positions still come exclusively from `deriveProductionAreaDiagramLayout`
 * (dagre) — react-flow is a renderer here, never a second layout engine.
 *
 * Deliberately NOT enabled, per ADR-0016's guardrails against the "since
 * it's already there" interactivity creep ADR-0009 originally warned
 * about: node dragging, node/edge connecting, element selection, a
 * minimap, or multi-select. `nodesDraggable`/`nodesConnectable`/
 * `elementsSelectable` below are explicitly set to `false` rather than left
 * at react-flow's defaults. Any future request to enable one of these
 * needs its own ADR and `product-scope-guardian` review, same as ADR-0009's
 * own item 7 already required.
 */
export function AreaDependencyDiagram({
  areas,
  relationships,
  owner,
  repo,
  commitSha,
}: AreaDependencyDiagramProps) {
  const layout = deriveProductionAreaDiagramLayout(areas, relationships);

  const nodes: Node<AreaNodeData>[] = useMemo(
    () =>
      (layout?.nodes ?? []).map((node) => ({
        id: node.id,
        type: "areaNode",
        position: { x: node.x, y: node.y },
        style: { width: node.width, height: node.height },
        data: {
          name: node.name,
          responsibility: node.responsibility,
          href: githubTreeUrl(owner, repo, commitSha, node.location),
        },
      })),
    [layout, owner, repo, commitSha]
  );

  const edges: Edge[] = useMemo(
    () =>
      (layout?.edges ?? []).map((edge) => ({
        id: `${edge.fromId}->${edge.toId}`,
        source: edge.fromId,
        target: edge.toId,
        type: "smoothstep",
        style: {
          stroke: "var(--border)",
          strokeWidth: 1.5,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border)" },
      })),
    [layout]
  );

  if (!layout) return null;

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
      <div
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height: Math.min(Math.max(layout.height + 80, 320), 600) }}
        role="img"
        aria-label="Diagram of how major areas depend on each other"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          {/* `showInteractive={false}` hides react-flow's default "Toggle
              Interactivity" button, whose only purpose is to re-enable
              nodesDraggable/nodesConnectable/elementsSelectable — the exact
              capabilities ADR-0016 disables above. The explicit props above
              already win even if it were clicked, but a control whose sole
              function is to undo a deliberate guardrail shouldn't be
              offered at all. */}
          <Controls showInteractive={false} />
        </ReactFlow>
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
