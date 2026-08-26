/**
 * A small, extensible framework-recognition mechanism (ADR-0013, prompt §3:
 * "create a clean extensible framework-recognition mechanism... React and
 * Next.js are the first framework adapters, not the last ones"). Each
 * `FrameworkDetector` contributes `EntryPoint`s and Program Behavior Graph
 * nodes/edges from one framework's conventions; `extract-project.ts` runs
 * `FRAMEWORK_DETECTORS` generically, so a future adapter (Vue, a queue
 * consumer convention, ...) is one more array entry, not a rewrite of the
 * orchestration.
 *
 * Boundary/IO detection (`boundary-detectors.ts`) is intentionally *not*
 * one of these — it isn't framework-specific (a raw `fetch()` call has
 * nothing to do with React or Next.js) — and stays a separate pass in
 * `extract-project.ts`.
 */

import type { SourceFile } from "ts-morph";
import type { BehaviorEdge, BehaviorNode, EntryPoint } from "@/lore/model";
import type { CallableIndex } from "./callable-index";
import { detectNextjsConventions } from "./nextjs-conventions";
import { detectReactEffects } from "./react-effects";
import { detectReactEvents } from "./react-events";
import { detectReactState } from "./react-hooks";

export interface FrameworkDetectionResult {
  entryPoints: EntryPoint[];
  behaviorNodes: BehaviorNode[];
  behaviorEdges: BehaviorEdge[];
}

export interface FrameworkDetector {
  name: string;
  detect(
    sourceFiles: SourceFile[],
    rootDir: string,
    index: CallableIndex
  ): FrameworkDetectionResult;
}

export const reactFrameworkDetector: FrameworkDetector = {
  name: "react",
  detect(sourceFiles, rootDir, index) {
    const hooks = detectReactState(sourceFiles, rootDir, index);
    const events = detectReactEvents(sourceFiles, rootDir, index);
    const effects = detectReactEffects(
      sourceFiles,
      rootDir,
      index,
      hooks.stateBindingsByOwnerId
    );
    return {
      entryPoints: [],
      behaviorNodes: hooks.nodes,
      behaviorEdges: [...hooks.edges, ...events, ...effects],
    };
  },
};

export const nextjsFrameworkDetector: FrameworkDetector = {
  name: "nextjs",
  detect(sourceFiles, rootDir) {
    return {
      entryPoints: detectNextjsConventions(sourceFiles, rootDir),
      behaviorNodes: [],
      behaviorEdges: [],
    };
  },
};

export const FRAMEWORK_DETECTORS: FrameworkDetector[] = [
  reactFrameworkDetector,
  nextjsFrameworkDetector,
];
