"use client";

import { cn } from "@/lib/cn";
import { formatPath } from "@/lib/format-path";
import {
  deriveCallGraphLayout,
  MAX_CALL_GRAPH_NODES,
} from "@/lore/call-graph-layout";
import type { CallableSignature, CallEdge, EntityId } from "@/lore/model";
import type { HTMLAttributes } from "react";

// SVG's <foreignObject> requires its HTML content to declare the XHTML
// namespace explicitly; React's HTML element types don't model `xmlns`, so
// it's cast in rather than typed as a first-class prop (same approach as
// AreaDependencyDiagram).
const XHTML_NAMESPACE = {
  xmlns: "http://www.w3.org/1999/xhtml",
} as HTMLAttributes<HTMLDivElement>;

export interface DataFlowDiagramProps {
  focusId: EntityId;
  signatures: CallableSignature[];
  edges: CallEdge[];
  onSelect: (id: EntityId) => void;
}

/**
 * An interactive, client-side box-and-arrow diagram of one function's local
 * call-graph neighborhood — a deliberate, separately-scoped exception to
 * ADR-0009's "no interactivity" rule (see ADR-0012). Node positions/edge
 * routing come from `@dagrejs/dagre`, reused client-side purely for layout;
 * clicking a node re-focuses the graph on it (drilldown) rather than
 * navigating away. The rendered subgraph is always bounded
 * (`MAX_CALL_GRAPH_NODES`) — never the whole repository's call graph.
 */
export function DataFlowDiagram({
  focusId,
  signatures,
  edges,
  onSelect,
}: DataFlowDiagramProps) {
  const layout = deriveCallGraphLayout(focusId, signatures, edges);
  if (!layout) return null;

  return (
    <div>
      {layout.truncated && (
        <p className="mb-3 rounded-lg border border-border bg-tile-supporting-bg/40 px-3 py-2 text-xs text-muted">
          This function&apos;s full call chain has more than{" "}
          {MAX_CALL_GRAPH_NODES} related functions — showing direct callers and
          callees only.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label="Data flow diagram for the selected function"
        >
          <defs>
            <marker
              id="call-graph-arrowhead"
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
              markerEnd="url(#call-graph-arrowhead)"
            />
          ))}

          {layout.nodes.map((node) => (
            <foreignObject
              key={node.id}
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
            >
              <div
                {...XHTML_NAMESPACE}
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border px-3 py-1.5 text-center",
                  node.isFocus
                    ? "border-primary bg-tile-core-bg"
                    : "border-border bg-surface"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(node.id)}
                  className="w-full truncate text-xs font-medium text-foreground hover:underline"
                >
                  {node.name}
                </button>
                <span className="w-full truncate text-[10px] text-muted">
                  {formatPath(node.location.filePath)}
                </span>
              </div>
            </foreignObject>
          ))}
        </svg>
      </div>
    </div>
  );
}
