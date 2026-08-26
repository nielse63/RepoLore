/**
 * Human-readable text for a structured `ImportanceReason` (ADR-0013, prompt
 * §13) — the "why it matters" bullet list `CallGraphContent.tsx`'s detail
 * panel renders for a focused function's importance score. Kept separate
 * from the component so the same descriptions can be reused by a future
 * non-UI surface (e.g. a CLI/debug dump) without pulling in React.
 */

import type { BoundaryType, EntityId, ImportanceReason } from "./model";

const BOUNDARY_LABEL: Record<BoundaryType, string> = {
  http: "an HTTP boundary",
  database: "a database",
  filesystem: "the filesystem",
  "browser-storage": "browser storage",
  "external-sdk": "an external SDK",
  other: "an external boundary",
};

export function describeImportanceReason(
  reason: ImportanceReason,
  stateNameById: Map<EntityId, string>
): string {
  switch (reason.type) {
    case "HIGH_REACHABILITY":
      return `Reachable from ${reason.reachableFunctions} function(s) across ${reason.reachableModules} module(s).`;
    case "ORCHESTRATES_MODULES":
      return `Coordinates ${reason.moduleCount} other module(s) directly.`;
    case "CROSSES_BOUNDARY":
      return `Crosses ${BOUNDARY_LABEL[reason.boundaryType]}.`;
    case "MUTATES_STATE": {
      const name = stateNameById.get(reason.stateId);
      const scope = reason.stateScope === "shared" ? "shared" : "local";
      return name
        ? `Writes ${scope} state '${name}'.`
        : `Writes ${scope} state.`;
    }
    case "ENTRY_POINT":
      return `Reached directly as a ${reason.entryPointKind.replace(/-/g, " ")} entry point.`;
    case "STRUCTURAL_HUB":
      return `Structural hub: ${reason.fanIn} caller(s), ${reason.fanOut} callee(s).`;
  }
}
