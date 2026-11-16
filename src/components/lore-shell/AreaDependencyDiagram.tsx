"use client";

import { AreaInspector } from "@/components/lore-shell/AreaInspector";
import { useAreaMapInspector } from "@/components/lore-shell/AreaMapFrame";
import { Button } from "@/components/ui/Button";
import { githubTreeUrl } from "@/github/urls";
import { cn } from "@/lib/cn";
import { formatPath } from "@/lib/format-path";
import {
  areaEdgeId,
  areaNeighborhood,
  DEFAULT_DIAGRAM_AREAS,
  deriveProductionAreaDiagramLayout,
  deriveProductionAreaGraph,
  MAX_DIAGRAM_AREAS,
  smoothEdgePath,
} from "@/lore/area-diagram-layout";
import type { EntityId, Relationship, StructuralArea } from "@/lore/model";
import {
  Background,
  BaseEdge,
  Controls,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: EntityId, trigger: HTMLElement) => void;
}

/** An area's own directory name, e.g. "utils" for "src/utils". */
function areaLabel(name: string) {
  return formatPath(name).split("/").filter(Boolean).at(-1) ?? "/";
}

function AreaNode({ id, data }: NodeProps<Node<AreaNodeData>>) {
  const style =
    VARIANT_CLASSES[responsibilityStyle(data.responsibility).variant];
  // Dimmed nodes change color rather than opacity, so their labels keep
  // AA contrast.
  const fg = data.dimmed ? "text-muted" : style.fg;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <button
        type="button"
        aria-pressed={data.selected}
        title={formatPath(data.name)}
        onClick={(event) => data.onSelect(id, event.currentTarget)}
        // react-flow turns pointer events off on a node that's neither
        // selectable nor draggable (ADR-0016), so the button opts back in;
        // `nopan` keeps a press on it from panning the canvas instead.
        className={cn(
          "nopan pointer-events-auto flex h-full w-full cursor-pointer flex-col items-start justify-center gap-1 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          data.dimmed
            ? "border-border/60 bg-surface"
            : `border-border hover:border-primary ${style.bg}`,
          data.selected && "border-primary ring-2 ring-primary"
        )}
      >
        <span className={cn("w-full truncate text-sm font-semibold", fg)}>
          {areaLabel(data.name)}
        </span>
        <span className={cn("w-full truncate font-mono text-xs", fg)}>
          {formatPath(data.name)}
        </span>
      </button>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </>
  );
}

interface AreaEdgeData extends Record<string, unknown> {
  points: { x: number; y: number }[];
}

/**
 * Draws an edge along dagre's routed points (`smoothEdgePath`), falling
 * back to react-flow's own bezier only when dagre gave no route.
 */
function AreaEdge({
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps<Edge<AreaEdgeData>>) {
  const path =
    data && data.points.length >= 2
      ? smoothEdgePath(data.points)
      : getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        })[0];
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}

const NODE_TYPES = { areaNode: AreaNode };
const EDGE_TYPES = { areaEdge: AreaEdge };

// `--muted`, not `--border`: the border token is nearly the canvas color, so
// edges and arrowheads all but vanished (GitHub issue #51).
const EDGE_COLOR = "var(--muted)";
const FOCUSED_EDGE_COLOR = "var(--primary)";

export interface AreaDependencyDiagramProps {
  // Every Major Area, even on a System subview (`pinnedAreaId`): the map
  // scopes itself to that area's neighborhood, while the inspector lists a
  // selected neighbor's relationships across all of them.
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
  // builds GitHub URLs itself via `githubTreeUrl`, rather than the
  // callback-style `areaUrl?: (location) => string` other lore-shell
  // components use.
  owner: string;
  repo: string;
  commitSha: string;
  // A System subview's own area: the map shows it and its direct
  // neighbors, always including it, with the caption counting neighbors.
  pinnedAreaId?: EntityId;
}

/**
 * Renders the area dependency diagram client-side with `@xyflow/react`
 * (react-flow), per ADR-0016, which narrowly amends ADR-0009's original
 * "static, non-interactive" decision to allow pan/zoom/`fitView` once the
 * product owner found larger diagrams didn't fit the fixed viewport. Node
 * positions and edge routes still come exclusively from
 * `deriveProductionAreaDiagramLayout` (dagre) — react-flow is a renderer here, never a
 * second layout engine.
 *
 * GitHub issue #79 amends ADR-0016, after `product-scope-guardian` review,
 * to allow exactly this, as local view state (never in the URL or storage):
 * selecting one area at a time, which opens the shared inspector
 * (`AreaInspector`, rendered into `AreaMapFrame`'s slot) and moves the
 * node's GitHub link there; "Focus on selected area", dimming everything
 * outside its one-hop neighborhood (`areaNeighborhood`); "Expand map", a
 * taller in-page canvas; "Show all areas", from `DEFAULT_DIAGRAM_AREAS` up
 * to `MAX_DIAGRAM_AREAS`; and a custom edge drawn smoothly along dagre's
 * routed points. Hover only restyles a node; it doesn't preview the focus.
 *
 * Still deliberately NOT enabled, per ADR-0016's guardrails against the
 * "since it's already there" interactivity creep ADR-0009 originally warned
 * about: node dragging, node/edge connecting, react-flow element selection,
 * a minimap, or multi-select. `nodesDraggable`/`nodesConnectable`/
 * `elementsSelectable` below are explicitly set to `false` rather than left
 * at react-flow's defaults. Anything beyond the list above — hover
 * previews, path/impact tracing, multi-hop focus, filters, search in the
 * map, layout persistence, deep-linking a selection — needs its own ADR and
 * `product-scope-guardian` review, same as ADR-0009's own item 7 required.
 */
export function AreaDependencyDiagram({
  areas,
  relationships,
  owner,
  repo,
  commitSha,
  pinnedAreaId,
}: AreaDependencyDiagramProps) {
  const { inspector, slot } = useAreaMapInspector();
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focus, setFocus] = useState(false);
  const focusHintId = useId();
  const figureRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<
    Node<AreaNodeData>,
    Edge<AreaEdgeData>
  > | null>(null);

  // Re-fit whenever the canvas changes size — "Expand map", or the
  // inspector opening beside it and narrowing the page — since react-flow
  // only applies `fitView` on mount. The first observation is just the
  // mount size, which `fitView` already handles.
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    let last: { width: number; height: number } | undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (last && (last.width !== width || last.height !== height)) {
        flowRef.current?.fitView();
      }
      last = { width, height };
    });
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);

  const graph = useMemo(
    () => deriveProductionAreaGraph(areas, relationships),
    [areas, relationships]
  );
  // The same function each page gates on, so the gate and what renders
  // can't disagree.
  const layout = useMemo(
    () =>
      deriveProductionAreaDiagramLayout(
        areas,
        relationships,
        pinnedAreaId,
        showAll ? MAX_DIAGRAM_AREAS : DEFAULT_DIAGRAM_AREAS
      ),
    [areas, relationships, pinnedAreaId, showAll]
  );

  const selectedId = inspector.open ? inspector.selectedId : undefined;
  const selectedArea = graph.productionAreas.find(
    (area) => area.id === selectedId
  );
  const neighborhood =
    focus && selectedId && layout
      ? areaNeighborhood(layout.edges, selectedId)
      : null;
  const { select, close } = inspector;

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
          selected: node.id === selectedId,
          dimmed: !!neighborhood && !neighborhood.nodeIds.has(node.id),
          onSelect: select,
        },
      })),
    [layout, selectedId, neighborhood, select]
  );

  const edges: Edge<AreaEdgeData>[] = useMemo(
    () =>
      (layout?.edges ?? []).map((edge) => {
        const id = areaEdgeId(edge);
        const focused = !!neighborhood?.edgeIds.has(id);
        const color = focused ? FOCUSED_EDGE_COLOR : EDGE_COLOR;
        return {
          id,
          source: edge.fromId,
          target: edge.toId,
          type: "areaEdge",
          data: { points: edge.points },
          style: {
            stroke: color,
            strokeWidth: focused ? 2 : 1.25,
            opacity: neighborhood && !focused ? 0.15 : 1,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }),
    [layout, neighborhood]
  );

  if (!layout) return null;

  const shownIds = new Set(layout.nodes.map((node) => node.id));
  const truncated = layout.connectedAreaCount > layout.nodes.length;
  const canShowMore =
    layout.connectedAreaCount > DEFAULT_DIAGRAM_AREAS || showAll;
  const showMoreLabel =
    layout.connectedAreaCount > MAX_DIAGRAM_AREAS
      ? `Show ${MAX_DIAGRAM_AREAS} areas`
      : "Show all areas";
  const height = expanded
    ? "max(640px, calc(100dvh - 10rem))"
    : Math.min(Math.max(layout.height + 80, 320), 600);

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
    <div
      id="area-dependency-diagram"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedId) close();
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label
          className={cn(
            "flex items-center gap-2 text-sm",
            selectedId ? "text-foreground" : "text-muted"
          )}
        >
          <input
            type="checkbox"
            checked={focus && !!selectedId}
            disabled={!selectedId}
            onChange={(event) => setFocus(event.target.checked)}
            aria-describedby={focusHintId}
            className="h-4 w-4 accent-primary"
          />
          Focus on selected area
        </label>
        <span id={focusHintId} className="text-xs text-muted">
          {selectedId
            ? "Dims areas not directly connected to the selection"
            : "Select an area to focus on it"}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canShowMore && (
            <Button
              variant="secondary"
              className="px-3 py-1.5"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show fewer areas" : showMoreLabel}
            </Button>
          )}
          <Button
            variant="secondary"
            className="px-3 py-1.5"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Return to normal view" : "Expand map"}
          </Button>
        </div>
      </div>
      <figure
        ref={figureRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ height }}
        aria-label="Diagram of how major areas depend on each other"
      >
        <ReactFlow
          // Remounting re-applies `fitView` to a new node set; the selection
          // lives outside, so it's kept.
          key={String(showAll)}
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          fitView
          // react-flow's default `minZoom` (0.5) also clamps `fitView`, so a
          // wide graph stayed at 0.5 with its outer nodes clipped (GitHub
          // issue #51). 0.05 fits even a `MAX_DIAGRAM_AREAS`-wide single rank
          // in the Systems rail; Zoom In stays available for reading labels.
          minZoom={0.05}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // Each node's own button takes focus instead (Tab, then Enter or
          // Space selects), so react-flow's node/edge wrappers don't add a
          // second, inert tab stop.
          nodesFocusable={false}
          edgesFocusable={false}
          onPaneClick={() => close()}
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
      </figure>
      <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted">
        <span>Arrows point to imported dependencies</span>
        <span>Select an area for its evidence</span>
      </div>
      {/* Wording per `product-scope-guardian`: the subset is in Major Areas
          order, never described as the "top", "key" or most important
          areas (ADR-0014). */}
      {truncated && (
        <p className="mt-3 text-xs text-muted">
          {pinnedAreaId
            ? `Showing this system and ${layout.nodes.length - 1} of its ${layout.connectedAreaCount - 1} connected neighbors, in Major Areas order.`
            : `Showing ${layout.nodes.length} of ${layout.connectedAreaCount} connected areas, in Major Areas order.`}{" "}
          Arrows include only imports resolved to a file in this repository;
          unresolved or dynamic imports are Unknown. Full list:{" "}
          <Link
            href={`/lore/${owner}/${repo}/architecture#component-connections`}
            className="font-medium text-primary hover:underline"
          >
            Component Connections
          </Link>
          .
        </p>
      )}
      {truncated && layout.unconnected.length > 0 && (
        <p className="mt-1 text-xs text-muted">
          {layout.unconnected.length}{" "}
          {layout.unconnected.length === 1 ? "area has" : "areas have"} no
          detected production relationships.
        </p>
      )}
      {!truncated && layout.unconnected.length > 0 && (
        <div className="mt-3 text-xs text-muted">
          <p id="area-dependency-diagram-unconnected">
            Not connected to other areas:
          </p>
          <ul
            aria-labelledby="area-dependency-diagram-unconnected"
            className="mt-1 flex flex-wrap gap-x-3 gap-y-1"
          >
            {layout.unconnected.map((area) => (
              <li key={area.id}>
                <a
                  href={githubTreeUrl(owner, repo, commitSha, area.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:underline"
                >
                  {formatPath(area.name)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      {slot &&
        selectedArea &&
        createPortal(
          <AreaInspector
            inspector={inspector}
            area={selectedArea}
            areas={graph.productionAreas}
            relationships={graph.productionRelationships}
            shownIds={shownIds}
            owner={owner}
            repo={repo}
            commitSha={commitSha}
          />,
          slot
        )}
    </div>
  );
}
