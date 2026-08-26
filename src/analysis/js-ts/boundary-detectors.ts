/**
 * Boundary/IO detection (ADR-0013, prompt §10): a small, explicitly-isolated
 * table of well-known browser globals and package specifiers, not an
 * attempt to hardcode every third-party library (prompt's explicit
 * instruction) — extending coverage is a table edit here, not a change to
 * core graph logic.
 *
 * Deliberately coarse: any reference to a boundary-bound identifier within a
 * named function counts as one `IO` edge to that boundary (deduplicated per
 * function+boundary pair), rather than tracing the specific call chain
 * (e.g. `pool.query(...)` after `const pool = new Pool()`) — a disclosed
 * approximation, not full taint analysis (prompt §7).
 */

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type {
  BehaviorEdge,
  BehaviorNode,
  BoundaryType,
  SourceLocation,
} from "@/lore/model";
import {
  enclosingNamedCallable,
  toRelative,
  type CallableIndex,
} from "./callable-index";

const GLOBAL_BOUNDARIES: Record<string, BoundaryType> = {
  fetch: "http",
  XMLHttpRequest: "http",
  localStorage: "browser-storage",
  sessionStorage: "browser-storage",
  indexedDB: "browser-storage",
};

const PACKAGE_BOUNDARIES: Record<string, BoundaryType> = {
  axios: "http",
  "node-fetch": "http",
  fs: "filesystem",
  "node:fs": "filesystem",
  "fs/promises": "filesystem",
  "node:fs/promises": "filesystem",
  pg: "database",
  mysql2: "database",
  mysql: "database",
  mongoose: "database",
  "@prisma/client": "database",
  knex: "database",
  redis: "database",
  ioredis: "database",
};

export interface BoundaryDetection {
  nodes: BehaviorNode[];
  edges: BehaviorEdge[];
}

export function detectBoundaries(
  sourceFiles: SourceFile[],
  rootDir: string,
  index: CallableIndex
): BoundaryDetection {
  const nodes: BehaviorNode[] = [];
  const edges: BehaviorEdge[] = [];
  const nodeIdByName = new Map<string, string>();
  const emittedPairs = new Set<string>();
  let edgeCount = 0;

  function boundaryNodeId(name: string, boundaryType: BoundaryType): string {
    const existing = nodeIdByName.get(name);
    if (existing) return existing;
    const id = `js-ts-boundary-${nodeIdByName.size + 1}`;
    nodeIdByName.set(name, id);
    nodes.push({ id, kind: "boundary", name, boundaryType });
    return id;
  }

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const fileIndex = index.byFilePath.get(filePath);
    if (!fileIndex) continue;

    const localBoundaryNames = new Map<string, BoundaryType>();
    for (const importDecl of sourceFile.getImportDeclarations()) {
      const boundaryType =
        PACKAGE_BOUNDARIES[importDecl.getModuleSpecifierValue()];
      if (!boundaryType) continue;

      const defaultImport = importDecl.getDefaultImport();
      if (defaultImport)
        localBoundaryNames.set(defaultImport.getText(), boundaryType);

      const namespaceImport = importDecl.getNamespaceImport();
      if (namespaceImport)
        localBoundaryNames.set(namespaceImport.getText(), boundaryType);

      for (const named of importDecl.getNamedImports()) {
        const localName = named.getAliasNode()?.getText() ?? named.getName();
        localBoundaryNames.set(localName, boundaryType);
      }
    }

    for (const identifier of sourceFile.getDescendantsOfKind(
      SyntaxKind.Identifier
    )) {
      const text = identifier.getText();
      const boundaryType =
        localBoundaryNames.get(text) ?? GLOBAL_BOUNDARIES[text];
      if (!boundaryType) continue;

      const parent = identifier.getParent();
      if (
        parent &&
        (Node.isImportSpecifier(parent) ||
          Node.isImportClause(parent) ||
          Node.isNamespaceImport(parent))
      ) {
        continue; // the import binding itself, not a usage
      }

      const enclosing = enclosingNamedCallable(identifier, fileIndex.byNode);
      if (!enclosing) continue;

      const nodeId = boundaryNodeId(text, boundaryType);
      const dedupeKey = `${enclosing.signature.id}->${nodeId}`;
      if (emittedPairs.has(dedupeKey)) continue;
      emittedPairs.add(dedupeKey);

      const location: SourceLocation = {
        filePath,
        startLine: identifier.getStartLineNumber(),
      };
      edgeCount += 1;
      edges.push({
        id: `js-ts-io-${edgeCount}`,
        source: enclosing.signature.id,
        target: nodeId,
        type: "IO",
        certainty: "detected",
        location,
        evidence: [
          {
            kind: "boundary-reference",
            certainty: "detected",
            location,
            description: `'${enclosing.signature.name}' references '${text}' (${boundaryType}) in '${filePath}'.`,
          },
        ],
      });
    }
  }

  return { nodes, edges };
}
