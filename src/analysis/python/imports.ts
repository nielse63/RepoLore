/**
 * Extracts internal dependency edges (import/from-import relationships
 * between discovered source files) as shared-model `Relationship`s, per
 * ADR-0006 (syntactic-only: based on import statements, not resolved
 * semantics).
 */

import type { Node as TSNode } from "web-tree-sitter";
import type { Gap, Relationship, SourceLocation } from "@/lore/model";
import type { PythonSourceFile } from "./discovery";
import {
  buildModuleResolutionIndex,
  relativeBaseDir,
} from "./module-resolution";
import { descendantsOfType, directChildrenOfType, lineOf } from "./syntax";

/** Dotted-path targets of a bare `import a.b, c as d` statement. */
function parseBareImportTargets(stmt: TSNode): string[][] {
  const dottedNames = directChildrenOfType(stmt, "dotted_name").map(
    (n) => n.text
  );
  const aliasedNames = directChildrenOfType(stmt, "aliased_import").map((n) => {
    const dotted = directChildrenOfType(n, "dotted_name")[0];
    return dotted ? dotted.text : n.text;
  });
  return [...dottedNames, ...aliasedNames].map((t) => t.split("."));
}

/** The dot-count (`level`) and dotted module path of a `from ... import` statement's module clause. */
function parseModuleNameField(moduleNameNode: TSNode): {
  level: number;
  moduleSegments: string[];
} {
  if (moduleNameNode.type === "relative_import") {
    const prefixNode = directChildrenOfType(moduleNameNode, "import_prefix")[0];
    const level = prefixNode ? prefixNode.text.length : 0;
    const dottedNameNode = directChildrenOfType(
      moduleNameNode,
      "dotted_name"
    )[0];
    const moduleSegments = dottedNameNode ? dottedNameNode.text.split(".") : [];
    return { level, moduleSegments };
  }
  return { level: 0, moduleSegments: moduleNameNode.text.split(".") };
}

/** The imported names of a `from ... import a, b as c` statement (alias dropped; resolution is by original name). */
export function parseImportedNames(stmt: TSNode): {
  names: string[];
  isWildcard: boolean;
} {
  if (directChildrenOfType(stmt, "wildcard_import").length > 0) {
    return { names: [], isWildcard: true };
  }
  const nameNodes = stmt.childrenForFieldName("name");
  const names = nameNodes.map((n) => {
    if (n.type === "aliased_import") {
      const dotted = directChildrenOfType(n, "dotted_name")[0];
      return dotted ? dotted.text : n.text;
    }
    return n.text;
  });
  return { names, isWildcard: false };
}

function buildRelationship(
  id: string,
  fromId: string,
  toId: string,
  location: SourceLocation,
  description: string
): Relationship {
  return {
    id,
    kind: "depends-on",
    fromId,
    toId,
    certainty: "detected",
    evidence: [
      {
        kind: "import-statement",
        certainty: "detected",
        location,
        description,
      },
    ],
  };
}

/** An unresolved absolute import's top-level module name — a candidate external-package usage, matched against declared `pyproject.toml` dependencies by `./external-dependencies.ts`. */
export interface ExternalReference {
  topLevelName: string;
  importerPath: string;
  line: number;
}

export interface ImportExtractionResult {
  relationships: Relationship[];
  gaps: Gap[];
  /**
   * Each file's distinct resolved internal dependency targets (repo-relative
   * paths), in the order they were first encountered. Reused by `./tests.ts`
   * so test-to-implementation linking doesn't re-implement import parsing.
   */
  resolvedDependenciesByFile: Map<string, string[]>;
  externalReferences: ExternalReference[];
}

export function extractImportRelationships(
  sourceFiles: PythonSourceFile[],
  rootDir: string
): ImportExtractionResult {
  const resolver = buildModuleResolutionIndex(sourceFiles, rootDir);
  const relationships: Relationship[] = [];
  const gaps: Gap[] = [];
  const resolvedDependenciesByFile = new Map<string, string[]>();
  const externalReferences: ExternalReference[] = [];
  let count = 0;

  for (const sourceFile of sourceFiles) {
    const importerPath = sourceFile.relativePath;
    // A single `from x import a, b, c` statement commonly resolves several
    // names to the same target file; dedupe per (importer, target) pair so
    // that doesn't produce repeated edges for one real dependency.
    const seenTargets = new Set<string>();

    for (const stmt of descendantsOfType(
      sourceFile.tree.rootNode,
      "import_statement"
    )) {
      const location: SourceLocation = {
        filePath: importerPath,
        startLine: lineOf(stmt),
      };
      for (const segments of parseBareImportTargets(stmt)) {
        const resolved = resolver.resolveUnderRoots(segments);
        if (!resolved) {
          // Standard-library/third-party; not a gap, but a candidate
          // external-package usage keyed by its top-level module name.
          externalReferences.push({
            topLevelName: segments[0],
            importerPath,
            line: lineOf(stmt),
          });
          continue;
        }
        if (seenTargets.has(resolved.relativePath)) continue;
        seenTargets.add(resolved.relativePath);
        count += 1;
        relationships.push(
          buildRelationship(
            `python-import-${count}`,
            importerPath,
            resolved.relativePath,
            location,
            `'${importerPath}' imports '${segments.join(".")}', resolved to '${resolved.relativePath}'.`
          )
        );
      }
    }

    for (const stmt of descendantsOfType(
      sourceFile.tree.rootNode,
      "import_from_statement"
    )) {
      const location: SourceLocation = {
        filePath: importerPath,
        startLine: lineOf(stmt),
      };
      const moduleNameNode = stmt.childForFieldName("module_name");
      if (!moduleNameNode) continue;
      const { level, moduleSegments } = parseModuleNameField(moduleNameNode);
      const { names } = parseImportedNames(stmt);
      const candidateNames = names.length > 0 ? names : [undefined];
      let anyResolved = false;

      for (const name of candidateNames) {
        const attempts: string[][] = name
          ? [[...moduleSegments, name], moduleSegments]
          : [moduleSegments];

        let resolved: PythonSourceFile | undefined;
        for (const segments of attempts) {
          if (segments.length === 0) continue;
          resolved =
            level > 0
              ? resolver.resolveUnderBase(
                  relativeBaseDir(sourceFile, level),
                  segments
                )
              : resolver.resolveUnderRoots(segments);
          if (resolved) break;
        }

        const specifierText = `${".".repeat(level)}${moduleSegments.join(".")}${
          name ? ` import ${name}` : " import *"
        }`;

        if (resolved) {
          anyResolved = true;
          if (seenTargets.has(resolved.relativePath)) continue;
          seenTargets.add(resolved.relativePath);
          count += 1;
          relationships.push(
            buildRelationship(
              `python-import-${count}`,
              importerPath,
              resolved.relativePath,
              location,
              `'${importerPath}' imports from '${specifierText}', resolved to '${resolved.relativePath}'.`
            )
          );
          continue;
        }

        if (level > 0) {
          // A relative import is unambiguously intra-project; an absolute
          // miss is not (see module-resolution.ts) and is intentionally not
          // recorded as a gap.
          gaps.push({
            certainty: "unknown",
            description: `Could not resolve relative import '${specifierText}' in '${importerPath}' to a discovered source file.`,
            location,
          });
        }
      }

      // An absolute `from x.y import ...` that didn't resolve to any
      // discovered file is a candidate external-package usage, keyed by its
      // top-level module name — recorded once per statement, not once per
      // imported name.
      if (level === 0 && !anyResolved && moduleSegments.length > 0) {
        externalReferences.push({
          topLevelName: moduleSegments[0],
          importerPath,
          line: lineOf(stmt),
        });
      }
    }

    resolvedDependenciesByFile.set(importerPath, [...seenTargets]);
  }

  return {
    relationships,
    gaps,
    resolvedDependenciesByFile,
    externalReferences,
  };
}
