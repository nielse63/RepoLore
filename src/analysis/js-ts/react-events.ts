/**
 * React JSX event-handler detection (ADR-0013, prompt §3 "Event handlers"):
 * a JSX attribute named like `onClick`/`onChange`/`onSubmit` produces an
 * `EVENT` edge from the enclosing (rendering) named function to the
 * resolved handler function.
 *
 * Two handler shapes are resolved:
 *   - a bare reference, `onClick={submit}`
 *   - a closure whose entire body is a single call, `onClick={() => submit()}`
 *     (through the closure to the named function underneath, per ADR-0013
 *     decision #6 — `call-graph.ts` never tracks anonymous callables, so a
 *     multi-statement closure has no id to attribute to and is skipped
 *     rather than guessed).
 */

import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from "ts-morph";
import type { BehaviorEdge, SourceLocation } from "@/lore/model";
import {
  enclosingNamedCallable,
  namedRelativeImportsForFile,
  resolveNamedCallable,
  toRelative,
  type CallableIndex,
} from "./callable-index";
import { buildModuleResolutionIndex } from "./module-resolution";

const EVENT_ATTRIBUTE_PATTERN = /^on[A-Z]/;

/** The single named function an event-handler expression resolves to, or `undefined` if it's not one of the two supported shapes. */
function resolveHandlerTargetName(expression: Node): string | undefined {
  if (Node.isIdentifier(expression)) return expression.getText();

  if (Node.isArrowFunction(expression)) {
    const body = expression.getBody();
    const call = singleCallExpression(body);
    const callee = call?.getExpression();
    if (callee && Node.isIdentifier(callee)) return callee.getText();
  }
  return undefined;
}

/** A closure body that amounts to exactly one call expression: a concise-body arrow whose body *is* the call, or a block with exactly one statement that is (optionally `await`ed) that call. */
function singleCallExpression(body: Node): CallExpression | undefined {
  if (Node.isCallExpression(body)) return body;
  if (Node.isAwaitExpression(body))
    return singleCallExpression(body.getExpression());

  if (Node.isBlock(body)) {
    const statements = body.getStatements();
    if (statements.length !== 1) return undefined;
    const [statement] = statements;
    if (!Node.isExpressionStatement(statement)) return undefined;
    const inner = statement.getExpression();
    if (Node.isAwaitExpression(inner))
      return singleCallExpression(inner.getExpression());
    if (Node.isCallExpression(inner)) return inner;
  }
  return undefined;
}

export function detectReactEvents(
  sourceFiles: SourceFile[],
  rootDir: string,
  index: CallableIndex
): BehaviorEdge[] {
  let edgeCount = 0;
  const edges: BehaviorEdge[] = [];
  const resolver = buildModuleResolutionIndex(sourceFiles);

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    if (!/\.(tsx|jsx)$/.test(filePath)) continue;
    const fileIndex = index.byFilePath.get(filePath);
    if (!fileIndex) continue;

    const imported = namedRelativeImportsForFile(sourceFile, rootDir, resolver);

    const attributes = [
      ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute),
    ];
    for (const attribute of attributes) {
      const attrName = attribute.getNameNode().getText();
      if (!EVENT_ATTRIBUTE_PATTERN.test(attrName)) continue;

      const initializer = attribute.getInitializer();
      if (!initializer || !Node.isJsxExpression(initializer)) continue;
      const expression = initializer.getExpression();
      if (!expression) continue;

      const targetName = resolveHandlerTargetName(expression);
      if (!targetName) continue;

      const handler = resolveNamedCallable(
        targetName,
        fileIndex,
        imported,
        index
      );
      if (!handler) continue;

      const renderer = enclosingNamedCallable(attribute, fileIndex.byNode);
      if (!renderer) continue;

      const location: SourceLocation = {
        filePath,
        startLine: attribute.getStartLineNumber(),
      };
      edgeCount += 1;
      edges.push({
        id: `js-ts-event-${edgeCount}`,
        source: renderer.signature.id,
        target: handler.signature.id,
        type: "EVENT",
        certainty: "detected",
        location,
        evidence: [
          {
            kind: "jsx-event-handler-prop",
            certainty: "detected",
            location,
            description: `'${renderer.signature.name}' wires the '${attrName}' event to '${handler.signature.name}' in '${filePath}'.`,
          },
        ],
      });
    }
  }

  return edges;
}
