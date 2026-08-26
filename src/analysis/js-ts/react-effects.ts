/**
 * `useEffect`/`useLayoutEffect` detection (ADR-0013, prompt §3 "Effects"):
 * represents that a change to a dependency can result in execution of the
 * effect body's calls — `FRAMEWORK` edges from each dependency that's a
 * known `useState`/`useReducer` value (via `react-hooks.ts`'s
 * `stateBindingsByOwnerId`) to every named function the effect body calls.
 * When no dependency matches a known state value (an empty deps array, a
 * deps entry that isn't a tracked state value, or no deps array at all),
 * the edge's source falls back to the owning component/hook function
 * itself, still representing "this function's effect invokes X."
 *
 * This is a static approximation of React's reactivity, not a runtime
 * reactivity analysis (prompt §3's explicit allowance) — `certainty` is
 * always `"inferred"`.
 */

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { BehaviorEdge, EntityId, SourceLocation } from "@/lore/model";
import {
  enclosingNamedCallable,
  namedRelativeImportsForFile,
  resolveNamedCallable,
  toRelative,
  type CallableIndex,
} from "./callable-index";
import { buildModuleResolutionIndex } from "./module-resolution";

const EFFECT_HOOK_NAMES = new Set(["useEffect", "useLayoutEffect"]);

export function detectReactEffects(
  sourceFiles: SourceFile[],
  rootDir: string,
  index: CallableIndex,
  stateBindingsByOwnerId: Map<EntityId, Map<string, EntityId>>
): BehaviorEdge[] {
  let edgeCount = 0;
  const edges: BehaviorEdge[] = [];
  const resolver = buildModuleResolutionIndex(sourceFiles);

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const fileIndex = index.byFilePath.get(filePath);
    if (!fileIndex) continue;

    const imported = namedRelativeImportsForFile(sourceFile, rootDir, resolver);

    for (const callExpr of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const expression = callExpr.getExpression();
      if (!Node.isIdentifier(expression)) continue;
      if (!EFFECT_HOOK_NAMES.has(expression.getText())) continue;

      const [callback, depsArg] = callExpr.getArguments();
      if (
        !callback ||
        (!Node.isArrowFunction(callback) &&
          !Node.isFunctionExpression(callback))
      ) {
        continue;
      }

      const owner = enclosingNamedCallable(callExpr, fileIndex.byNode);
      if (!owner) continue;

      const ownerBindings = stateBindingsByOwnerId.get(owner.signature.id);
      const sourceIds: EntityId[] = [];
      if (depsArg && Node.isArrayLiteralExpression(depsArg) && ownerBindings) {
        for (const dep of depsArg.getElements()) {
          if (!Node.isIdentifier(dep)) continue;
          const stateId = ownerBindings.get(dep.getText());
          if (stateId) sourceIds.push(stateId);
        }
      }
      if (sourceIds.length === 0) sourceIds.push(owner.signature.id);

      const location: SourceLocation = {
        filePath,
        startLine: callExpr.getStartLineNumber(),
      };

      const emitted = new Set<string>();
      for (const inner of callback.getDescendantsOfKind(
        SyntaxKind.CallExpression
      )) {
        const innerExpr = inner.getExpression();
        if (!Node.isIdentifier(innerExpr)) continue;
        const target = resolveNamedCallable(
          innerExpr.getText(),
          fileIndex,
          imported,
          index
        );
        if (!target) continue;

        for (const sourceId of sourceIds) {
          const dedupeKey = `${sourceId}->${target.signature.id}`;
          if (emitted.has(dedupeKey)) continue;
          emitted.add(dedupeKey);

          edgeCount += 1;
          edges.push({
            id: `js-ts-effect-${edgeCount}`,
            source: sourceId,
            target: target.signature.id,
            type: "FRAMEWORK",
            certainty: "inferred",
            location,
            evidence: [
              {
                kind: "use-effect-dependency",
                certainty: "inferred",
                location,
                description: `'${owner.signature.name}'s ${expression.getText()} calls '${target.signature.name}' in '${filePath}'.`,
              },
            ],
          });
        }
      }
    }
  }

  return edges;
}
