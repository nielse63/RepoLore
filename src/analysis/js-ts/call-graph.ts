/**
 * Extracts a function-level call graph (ADR-0012): named functions, methods,
 * and named arrow/function-expressions as `CallableSignature`s, plus
 * `CallEdge`s for statically resolvable direct calls between them. Also
 * emits `DATA_FLOW` `BehaviorEdge`s (ADR-0013) from the same resolved call
 * sites — additive, and it does not change `CallEdge`'s shape.
 *
 * Scope (see ADR-0012 for the full rationale): only plain-identifier calls
 * (`foo()`) are ever attempted — never property-access/method calls
 * (`obj.foo()`, `this.foo()`), computed calls (`obj[x]()`), or calls through
 * a variable/callback. A resolved call becomes a `detected` `CallEdge` only
 * when the identifier unambiguously matches a same-file named callable or a
 * callable reached through a *named* (not default) relative import, resolved
 * the same way `imports.ts`/`module-resolution.ts` resolve file-level edges.
 * Everything else that doesn't resolve this way is silently out of scope —
 * not recorded as a per-call-site `Gap` — since method calls and callbacks
 * are the dominant call shape in real JS/TS, and gapping every instance
 * would flood the model far worse than the pre-fix asset-import case
 * `module-resolution.ts` already guards against. Anonymous function
 * expressions/arrow functions (not assigned to a name) are not tracked as
 * `CallableSignature`s at all — there is no name to search for or display.
 */

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type {
  BehaviorEdge,
  CallableSignature,
  CallEdge,
  SourceLocation,
} from "@/lore/model";
import {
  buildCallableIndex,
  enclosingNamedCallable,
  namedRelativeImportsForFile,
  resolveNamedCallable,
  toRelative,
  type CallableIndex,
} from "./callable-index";
import { buildModuleResolutionIndex } from "./module-resolution";

/**
 * True when a call expression's result is used by something (assigned,
 * returned, passed as an argument, used in a template/condition, etc.)
 * rather than sitting as a bare statement (`foo();`, or `await foo();`).
 * This is a call-site *shape* check, not real taint analysis (ADR-0013 §8) —
 * it says data plausibly flows out of the call, not that any specific value
 * does.
 */
function isResultUsed(callExpr: Node): boolean {
  let node: Node = callExpr;
  const awaitParent = node.getParent();
  if (awaitParent && Node.isAwaitExpression(awaitParent)) {
    node = awaitParent;
  }
  const outerParent = node.getParent();
  if (!outerParent) return false;
  return !Node.isExpressionStatement(outerParent);
}

export interface CallGraphExtraction {
  callableSignatures: CallableSignature[];
  callEdges: CallEdge[];
  /** ADR-0013: `DATA_FLOW` edges from the same resolved call sites, callee (producer) -> caller (consumer). */
  dataFlowEdges: BehaviorEdge[];
}

export function extractCallGraph(
  sourceFiles: SourceFile[],
  rootDir: string,
  index: CallableIndex = buildCallableIndex(sourceFiles, rootDir)
): CallGraphExtraction {
  let edgeCount = 0;
  let dataFlowCount = 0;
  const callEdges: CallEdge[] = [];
  const dataFlowEdges: BehaviorEdge[] = [];

  const resolver = buildModuleResolutionIndex(sourceFiles, rootDir);

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const fileIndex = index.byFilePath.get(filePath);
    if (!fileIndex || fileIndex.byNode.size === 0) continue;

    const imported = namedRelativeImportsForFile(sourceFile, rootDir, resolver);

    for (const callExpr of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const expression = callExpr.getExpression();
      if (!Node.isIdentifier(expression)) continue;

      const caller = enclosingNamedCallable(callExpr, fileIndex.byNode);
      if (!caller) continue;

      const calleeName = expression.getText();
      const callee = resolveNamedCallable(
        calleeName,
        fileIndex,
        imported,
        index
      );
      if (!callee) continue;

      const callSiteLocation: SourceLocation = {
        filePath,
        startLine: callExpr.getStartLineNumber(),
      };
      edgeCount += 1;
      callEdges.push({
        id: `js-ts-call-${edgeCount}`,
        callerId: caller.signature.id,
        calleeId: callee.signature.id,
        callSiteLocation,
        certainty: "detected",
        evidence: [
          {
            kind: "call-expression",
            certainty: "detected",
            location: callSiteLocation,
            description: `'${caller.signature.name}' calls '${callee.signature.name}' in '${filePath}'.`,
          },
        ],
      });

      if (isResultUsed(callExpr)) {
        dataFlowCount += 1;
        dataFlowEdges.push({
          id: `js-ts-data-flow-${dataFlowCount}`,
          source: callee.signature.id,
          target: caller.signature.id,
          type: "DATA_FLOW",
          certainty: "inferred",
          location: callSiteLocation,
          evidence: [
            {
              kind: "call-result-used",
              certainty: "inferred",
              location: callSiteLocation,
              description: `'${caller.signature.name}' uses the result of calling '${callee.signature.name}' in '${filePath}', rather than discarding it.`,
            },
          ],
        });
      }
    }
  }

  return {
    callableSignatures: index.all.map((c) => c.signature),
    callEdges,
    dataFlowEdges,
  };
}
