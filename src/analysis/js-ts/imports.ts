/**
 * Extracts internal dependency edges (import/re-export relationships between
 * discovered source files) as shared-model `Relationship`s, per ADR-0003
 * (syntactic-only: based on import specifiers, not resolved types).
 */

import path from "node:path";
import type { SourceFile } from "ts-morph";
import type { Gap, Relationship, SourceLocation } from "@/lore/model";
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
  looksLikePathAlias,
} from "./module-resolution";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

interface ModuleSpecifierReference {
  specifier: string;
  line: number;
}

/** Every import and re-export specifier referenced from a source file, with its line. */
function getModuleSpecifierReferences(
  sourceFile: SourceFile,
): ModuleSpecifierReference[] {
  const references: ModuleSpecifierReference[] = [];

  for (const importDecl of sourceFile.getImportDeclarations()) {
    references.push({
      specifier: importDecl.getModuleSpecifierValue(),
      line: importDecl.getStartLineNumber(),
    });
  }

  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const specifier = exportDecl.getModuleSpecifierValue();
    if (specifier) {
      references.push({ specifier, line: exportDecl.getStartLineNumber() });
    }
  }

  return references;
}

export interface ImportExtractionResult {
  relationships: Relationship[];
  gaps: Gap[];
}

export function extractImportRelationships(
  sourceFiles: SourceFile[],
  rootDir: string,
): ImportExtractionResult {
  const resolver = buildModuleResolutionIndex(sourceFiles);
  const relationships: Relationship[] = [];
  const gaps: Gap[] = [];
  let relationshipCount = 0;

  for (const sourceFile of sourceFiles) {
    const importerPath = toRelative(rootDir, sourceFile.getFilePath());

    for (const { specifier, line } of getModuleSpecifierReferences(sourceFile)) {
      const importerLocation: SourceLocation = {
        filePath: importerPath,
        startLine: line,
      };

      if (isRelativeSpecifier(specifier)) {
        const resolved = resolver.resolve(sourceFile.getFilePath(), specifier);
        if (resolved) {
          relationshipCount += 1;
          const targetPath = toRelative(rootDir, resolved.getFilePath());
          relationships.push({
            id: `js-ts-import-${relationshipCount}`,
            kind: "depends-on",
            fromId: importerPath,
            toId: targetPath,
            certainty: "detected",
            evidence: [
              {
                kind: "import-statement",
                certainty: "detected",
                location: importerLocation,
                description: `'${importerPath}' imports from '${specifier}', resolved to '${targetPath}'.`,
              },
            ],
          });
          continue;
        }

        gaps.push({
          certainty: "unknown",
          description: `Could not resolve relative import '${specifier}' in '${importerPath}' to a discovered source file.`,
          location: importerLocation,
        });
        continue;
      }

      if (looksLikePathAlias(specifier)) {
        gaps.push({
          certainty: "unsupported",
          description: `Import '${specifier}' in '${importerPath}' appears to use a path alias; alias resolution (tsconfig 'paths') is not yet implemented (ADR-0003, deferred to implementation session 6).`,
          location: importerLocation,
        });
        continue;
      }

      // Bare specifiers (e.g. "react", "node:test") are external packages,
      // not internal dependency edges — intentionally not recorded.
    }
  }

  return { relationships, gaps };
}
