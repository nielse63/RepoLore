/**
 * Public surface extraction: a library entry point's package `__init__.py`
 * `__all__` declaration (detected) when present; otherwise top-level,
 * non-underscore-prefixed definitions and re-export imports declared
 * directly in `__init__.py` (inferred) — mirroring JS/TS's declared-field-
 * first, convention-fallback precedence.
 */

import type { Node as TSNode } from "web-tree-sitter";
import type { EntryPoint, PublicContract } from "@/lore/model";
import type { PythonSourceFile } from "./discovery";
import { parseImportedNames } from "./imports";
import {
  descendantsOfType,
  isStringLiteral,
  isTopLevel,
  nodesEqual,
  stringLiteralValue,
} from "./syntax";

const SURFACE_ENTRY_KINDS: ReadonlyArray<EntryPoint["kind"]> = ["library"];

/** A top-level `__all__ = [...]` assignment's string-literal names, if present. */
function parseDunderAll(sourceFile: PythonSourceFile): string[] | undefined {
  for (const assignment of descendantsOfType(
    sourceFile.tree.rootNode,
    "assignment"
  )) {
    // `assignment` is always wrapped in `expression_statement`; top-level
    // means that wrapper's parent is the module itself.
    const statement = assignment.parent;
    if (
      !statement ||
      statement.type !== "expression_statement" ||
      !nodesEqual(statement.parent, sourceFile.tree.rootNode)
    ) {
      continue;
    }
    const left = assignment.childForFieldName("left");
    const right = assignment.childForFieldName("right");
    if (!left || !right) continue;
    if (left.type !== "identifier" || left.text !== "__all__") continue;
    if (right.type !== "list") continue;
    return right.namedChildren
      .filter((n): n is TSNode => n !== null && isStringLiteral(n))
      .map((n) => stringLiteralValue(n));
  }
  return undefined;
}

function topLevelDefinitionNames(sourceFile: PythonSourceFile): string[] {
  const names: string[] = [];
  for (const def of [
    ...descendantsOfType(sourceFile.tree.rootNode, "function_definition"),
    ...descendantsOfType(sourceFile.tree.rootNode, "class_definition"),
  ]) {
    if (!isTopLevel(def, sourceFile.tree.rootNode)) continue;
    const nameNode = def.childForFieldName("name");
    if (!nameNode || nameNode.text.startsWith("_")) continue;
    names.push(nameNode.text);
  }
  return names;
}

function reExportedNames(sourceFile: PythonSourceFile): string[] {
  const names: string[] = [];
  for (const stmt of descendantsOfType(
    sourceFile.tree.rootNode,
    "import_from_statement"
  )) {
    if (!isTopLevel(stmt, sourceFile.tree.rootNode)) continue;
    const { names: imported } = parseImportedNames(stmt);
    names.push(...imported.filter((n) => !n.startsWith("_")));
  }
  return names;
}

export function extractPublicSurface(
  entryPoints: EntryPoint[],
  sourceFiles: PythonSourceFile[]
): PublicContract[] {
  const contracts: PublicContract[] = [];
  const byRelativePath = new Map(
    sourceFiles.map((sf) => [sf.relativePath, sf])
  );

  for (const entryPoint of entryPoints) {
    if (!SURFACE_ENTRY_KINDS.includes(entryPoint.kind)) continue;
    const entryFile = byRelativePath.get(entryPoint.location.filePath);
    if (!entryFile) continue;

    const dunderAll = parseDunderAll(entryFile);
    if (dunderAll) {
      for (const name of dunderAll) {
        contracts.push({
          id: `python-public-${entryPoint.location.filePath}-${name}`,
          areaId: entryPoint.location.filePath,
          name,
          kind: "export",
          location: {
            filePath: entryPoint.location.filePath,
            symbolName: name,
          },
          evidence: [
            {
              kind: "dunder-all-declaration",
              certainty: "detected",
              location: {
                filePath: entryPoint.location.filePath,
                symbolName: "__all__",
              },
              description: `'${name}' is declared in '${entryPoint.location.filePath}'s __all__.`,
            },
          ],
        });
      }
      continue;
    }

    const inferredNames = new Set([
      ...topLevelDefinitionNames(entryFile),
      ...reExportedNames(entryFile),
    ]);
    for (const name of inferredNames) {
      contracts.push({
        id: `python-public-${entryPoint.location.filePath}-${name}`,
        areaId: entryPoint.location.filePath,
        name,
        kind: "export",
        location: { filePath: entryPoint.location.filePath, symbolName: name },
        evidence: [
          {
            kind: "package-init-surface-convention",
            certainty: "inferred",
            location: {
              filePath: entryPoint.location.filePath,
              symbolName: name,
            },
            description: `No __all__ was declared in '${entryPoint.location.filePath}'; '${name}' is a non-underscore-prefixed top-level definition or re-export.`,
          },
        ],
      });
    }
  }

  return contracts;
}
