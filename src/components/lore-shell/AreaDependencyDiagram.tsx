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
import { useCallback, useMemo, useState } from "react";

// SPIKE: this file has been temporarily rewritten to render with
// @xyflow/react instead of the static server-rendered SVG described in
// ADR-0009. This is a throwaway exploration for a scope discussion, done on
// branch `spike/reactflow-area-diagram` — not a real change. See that ADR
// and non-goals.md for why the real implementation stays static.

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

interface AreaNodeData extends Record<string, unknown> {
  name: string;
  responsibility?: string;
  href?: string;
  isActive?: boolean;
  isDimmed?: boolean;
}

function AreaNode({ data }: NodeProps<Node<AreaNodeData>>) {
  const style =
    VARIANT_CLASSES[responsibilityStyle(data.responsibility).variant];
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-border px-3 py-2 text-center transition-[filter,opacity] duration-150 ${style.bg}`}
      style={{
        filter: data.isActive ? "brightness(0.9)" : undefined,
        opacity: data.isDimmed ? 0.4 : 1,
      }}
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
  // SPIKE NOTE: a client component can't accept a function prop from a
  // server component (RSC serialization boundary), so this replaces the
  // real component's `areaUrl?: (location) => string` callback with plain
  // data the client can build the same URL from itself.
  owner: string;
  repo: string;
  commitSha: string;
}

export function AreaDependencyDiagram({
  areas,
  relationships,
  owner,
  repo,
  commitSha,
}: AreaDependencyDiagramProps) {
  const layout = deriveProductionAreaDiagramLayout(areas, relationships);
  const rawEdges = useMemo(() => layout?.edges ?? [], [layout]);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  const handleNodeMouseEnter = useCallback(
    (_event: unknown, node: Node) => setHoveredNodeId(node.id),
    []
  );
  const handleNodeMouseLeave = useCallback(() => setHoveredNodeId(null), []);
  const handleEdgeMouseEnter = useCallback(
    (_event: unknown, edge: Edge) => setHoveredEdgeId(edge.id),
    []
  );
  const handleEdgeMouseLeave = useCallback(() => setHoveredEdgeId(null), []);

  // Neighborhood highlighted on hover: hovering a node highlights it, its
  // directly connected edges, and the nodes at the other end of those edges;
  // hovering an edge highlights just that edge and its two endpoint nodes.
  const { activeNodeIds, activeEdgeIds, isHighlightActive } = useMemo(() => {
    const activeNodeIds = new Set<string>();
    const activeEdgeIds = new Set<string>();

    if (hoveredNodeId) {
      activeNodeIds.add(hoveredNodeId);
      for (const edge of rawEdges) {
        if (edge.fromId === hoveredNodeId || edge.toId === hoveredNodeId) {
          activeEdgeIds.add(`${edge.fromId}->${edge.toId}`);
          activeNodeIds.add(edge.fromId);
          activeNodeIds.add(edge.toId);
        }
      }
    } else if (hoveredEdgeId) {
      const edge = rawEdges.find(
        (candidate) =>
          `${candidate.fromId}->${candidate.toId}` === hoveredEdgeId
      );
      if (edge) {
        activeEdgeIds.add(hoveredEdgeId);
        activeNodeIds.add(edge.fromId);
        activeNodeIds.add(edge.toId);
      }
    }

    return {
      activeNodeIds,
      activeEdgeIds,
      isHighlightActive: hoveredNodeId !== null || hoveredEdgeId !== null,
    };
  }, [rawEdges, hoveredNodeId, hoveredEdgeId]);

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
          isActive: activeNodeIds.has(node.id),
          isDimmed: isHighlightActive && !activeNodeIds.has(node.id),
        },
      })),
    [layout, owner, repo, commitSha, activeNodeIds, isHighlightActive]
  );

  const edges: Edge[] = useMemo(
    () =>
      rawEdges.map((edge) => {
        const id = `${edge.fromId}->${edge.toId}`;
        const isActive = activeEdgeIds.has(id);
        const isDimmed = isHighlightActive && !isActive;
        const stroke = isActive ? "var(--foreground)" : "var(--border)";
        return {
          id,
          source: edge.fromId,
          target: edge.toId,
          type: "smoothstep",
          style: {
            stroke,
            strokeWidth: isActive ? 2.5 : 1.5,
            opacity: isDimmed ? 0.35 : 1,
            transition:
              "stroke 150ms ease, stroke-width 150ms ease, opacity 150ms ease",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          selectable: false,
        };
      }),
    [rawEdges, activeEdgeIds, isHighlightActive]
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
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onEdgeMouseEnter={handleEdgeMouseEnter}
          onEdgeMouseLeave={handleEdgeMouseLeave}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
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
