/**
 * React state detection (ADR-0013, prompt §3 "State"): array-destructured
 * `useState`/`useReducer` calls produce a `BehaviorNode(kind: "state")`, a
 * `STATE_WRITE` edge from every named function that calls the setter/
 * dispatch, and an `inferred` `STATE_READ` edge from every named function
 * that references the value binding.
 *
 * Scope is limited to the nearest enclosing *named* function containing the
 * `useState`/`useReducer` call (almost always the component) — usages are
 * only searched for within that function's body, not the whole file, to
 * avoid cross-component name collisions. This is real scoping by AST
 * ancestry, not name matching, but it doesn't model JS lexical shadowing
 * inside that scope (e.g. a differently-scoped local variable that happens
 * to share the state's name) — a disclosed simplification, not full static
 * scope analysis (prompt §7's "avoid scope explosion").
 *
 * Context/Redux/Zustand/RxJS are out of scope for this version (prompt §3)
 * but nothing here assumes only `useState`/`useReducer` exist — a future
 * state-source adapter would produce the same `BehaviorNode`/edge shapes.
 */

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type {
  BehaviorEdge,
  BehaviorNode,
  EntityId,
  SourceLocation,
} from "@/lore/model";
import {
  enclosingNamedCallable,
  toRelative,
  type CallableIndex,
} from "./callable-index";

const STATE_HOOK_NAMES = new Set(["useState", "useReducer"]);

export interface ReactHooksExtraction {
  nodes: BehaviorNode[];
  edges: BehaviorEdge[];
  /** ownerCallableId -> state value binding name -> that state's `BehaviorNode.id`, consumed by `react-effects.ts` to correlate `useEffect` dependencies. */
  stateBindingsByOwnerId: Map<EntityId, Map<string, EntityId>>;
}

/** True when this identifier node is the array-binding declaration site itself, not a usage of it. */
function isBindingDeclaration(identifier: Node): boolean {
  const parent = identifier.getParent();
  return parent !== undefined && Node.isBindingElement(parent);
}

function isCallTarget(identifier: Node): boolean {
  const parent = identifier.getParent();
  return (
    parent !== undefined &&
    Node.isCallExpression(parent) &&
    parent.getExpression() === identifier
  );
}

export function detectReactState(
  sourceFiles: SourceFile[],
  rootDir: string,
  index: CallableIndex
): ReactHooksExtraction {
  let stateCount = 0;
  let edgeCount = 0;
  const nodes: BehaviorNode[] = [];
  const edges: BehaviorEdge[] = [];
  const stateBindingsByOwnerId = new Map<EntityId, Map<string, EntityId>>();

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const fileIndex = index.byFilePath.get(filePath);
    if (!fileIndex) continue;

    for (const callExpr of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const expression = callExpr.getExpression();
      if (!Node.isIdentifier(expression)) continue;
      if (!STATE_HOOK_NAMES.has(expression.getText())) continue;

      const declaration = callExpr.getParentIfKind(
        SyntaxKind.VariableDeclaration
      );
      if (!declaration) continue;
      const nameNode = declaration.getNameNode();
      if (!Node.isArrayBindingPattern(nameNode)) continue;
      const elements = nameNode.getElements();
      if (elements.length < 2) continue;

      const [valueElement, setterElement] = elements;
      const valueName = Node.isBindingElement(valueElement)
        ? valueElement.getName()
        : undefined;
      const setterName = Node.isBindingElement(setterElement)
        ? setterElement.getName()
        : undefined;
      if (!setterName) continue;

      const owner = enclosingNamedCallable(callExpr, fileIndex.byNode);
      if (!owner) continue;

      const location: SourceLocation = {
        filePath,
        symbolName: valueName ?? setterName,
        startLine: declaration.getStartLineNumber(),
      };
      stateCount += 1;
      const stateNodeId = `js-ts-state-${stateCount}`;

      const readerWriterIds = new Set<EntityId>();

      // Setter/dispatch calls -> STATE_WRITE, scoped to the owner's body.
      for (const identifier of owner.node.getDescendantsOfKind(
        SyntaxKind.Identifier
      )) {
        if (identifier.getText() !== setterName) continue;
        if (isBindingDeclaration(identifier)) continue;
        if (!isCallTarget(identifier)) continue;

        const writer = enclosingNamedCallable(identifier, fileIndex.byNode);
        if (!writer) continue;
        readerWriterIds.add(writer.signature.id);

        edgeCount += 1;
        edges.push({
          id: `js-ts-state-write-${edgeCount}`,
          source: writer.signature.id,
          target: stateNodeId,
          type: "STATE_WRITE",
          certainty: "detected",
          location: { filePath, startLine: identifier.getStartLineNumber() },
          evidence: [
            {
              kind: "state-setter-call",
              certainty: "detected",
              location: {
                filePath,
                startLine: identifier.getStartLineNumber(),
              },
              description: `'${writer.signature.name}' calls '${setterName}', writing to the state declared at '${filePath}:${declaration.getStartLineNumber()}'.`,
            },
          ],
        });
      }

      // Value-binding references -> STATE_READ (inferred: a reference isn't
      // necessarily behaviorally meaningful, unlike a direct setter call).
      if (valueName) {
        for (const identifier of owner.node.getDescendantsOfKind(
          SyntaxKind.Identifier
        )) {
          if (identifier.getText() !== valueName) continue;
          if (isBindingDeclaration(identifier)) continue;

          const reader = enclosingNamedCallable(identifier, fileIndex.byNode);
          if (!reader) continue;
          readerWriterIds.add(reader.signature.id);

          edgeCount += 1;
          edges.push({
            id: `js-ts-state-read-${edgeCount}`,
            source: reader.signature.id,
            target: stateNodeId,
            type: "STATE_READ",
            certainty: "inferred",
            location: { filePath, startLine: identifier.getStartLineNumber() },
            evidence: [
              {
                kind: "state-value-reference",
                certainty: "inferred",
                location: {
                  filePath,
                  startLine: identifier.getStartLineNumber(),
                },
                description: `'${reader.signature.name}' references '${valueName}', the state declared at '${filePath}:${declaration.getStartLineNumber()}'.`,
              },
            ],
          });
        }
      }

      nodes.push({
        id: stateNodeId,
        kind: "state",
        name: valueName ?? setterName,
        location,
        // A state read/written from more than one named function is
        // treated as shared; touched from only one, local (prompt §9) —
        // inferred from graph influence, never from the variable's name.
        stateScope: readerWriterIds.size > 1 ? "shared" : "local",
      });

      const ownerBindings =
        stateBindingsByOwnerId.get(owner.signature.id) ?? new Map();
      ownerBindings.set(valueName ?? setterName, stateNodeId);
      stateBindingsByOwnerId.set(owner.signature.id, ownerBindings);
    }
  }

  return { nodes, edges, stateBindingsByOwnerId };
}
