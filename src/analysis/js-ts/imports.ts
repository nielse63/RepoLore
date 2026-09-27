/**
 * Extracts internal dependency edges (import/re-export relationships between
 * discovered source files) as shared-model `Relationship`s, per ADR-0003
 * (syntactic-only: based on import specifiers, not resolved types).
 * Non-relative specifiers are resolved against `aliases` (from
 * `project-config.ts`, ADR-0015) when a configured alias matches.
 */

import path from "node:path";
import type { SourceFile } from "ts-morph";
import type { Gap, Relationship, SourceLocation } from "@/lore/model";
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
  looksLikeAssetImport,
  looksLikePathAlias,
  matchAlias,
} from "./module-resolution";
import type { PathAlias } from "./project-config";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

interface ModuleSpecifierReference {
  specifier: string;
  line: number;
}

/**
 * Every import and re-export specifier referenced from a source file, with
 * its line. A declaration whose module specifier isn't a plain string
 * literal — real syntax errors or non-standard syntax the TypeScript parser
 * can't fully make sense of are both recovered this way — can't be read by
 * `ts-morph` at all (it throws); that single declaration is skipped and
 * recorded as an `unsupported` gap instead of aborting the whole file.
 */
function getModuleSpecifierReferences(
  sourceFile: SourceFile,
  importerPath: string,
  gaps: Gap[]
): ModuleSpecifierReference[] {
  const references: ModuleSpecifierReference[] = [];

  const recordUnreadable = (line: number) => {
    gaps.push({
      certainty: "unsupported",
      description: `An import/export declaration in '${importerPath}' at line ${line} has a module specifier that isn't a plain string literal (likely a syntax error or non-standard syntax); it could not be analyzed.`,
      location: { filePath: importerPath, startLine: line },
    });
  };

  for (const importDecl of sourceFile.getImportDeclarations()) {
    const line = importDecl.getStartLineNumber();
    try {
      references.push({
        specifier: importDecl.getModuleSpecifierValue(),
        line,
      });
    } catch {
      recordUnreadable(line);
    }
  }

  for (const exportDecl of sourceFile.getExportDeclarations()) {
    const line = exportDecl.getStartLineNumber();
    let specifier: string | undefined;
    try {
      specifier = exportDecl.getModuleSpecifierValue();
    } catch {
      recordUnreadable(line);
      continue;
    }
    if (specifier) {
      references.push({ specifier, line });
    }
  }

  return references;
}

/** A bare (non-relative, non-alias) import specifier referenced from a file — a candidate external-package usage, resolved against declared `package.json` dependencies by `./external-dependencies.ts`. */
export interface ExternalReference {
  specifier: string;
  importerPath: string;
  line: number;
}

export interface ImportExtractionResult {
  relationships: Relationship[];
  gaps: Gap[];
  externalReferences: ExternalReference[];
}

export function extractImportRelationships(
  sourceFiles: SourceFile[],
  rootDir: string,
  aliases: PathAlias[] = []
): ImportExtractionResult {
  const resolver = buildModuleResolutionIndex(sourceFiles, rootDir, aliases);
  const relationships: Relationship[] = [];
  const gaps: Gap[] = [];
  const externalReferences: ExternalReference[] = [];
  let relationshipCount = 0;

  for (const sourceFile of sourceFiles) {
    const importerPath = toRelative(rootDir, sourceFile.getFilePath());

    for (const { specifier, line } of getModuleSpecifierReferences(
      sourceFile,
      importerPath,
      gaps
    )) {
      const importerLocation: SourceLocation = {
        filePath: importerPath,
        startLine: line,
      };

      if (isRelativeSpecifier(specifier)) {
        if (looksLikeAssetImport(specifier)) {
          // A relative import of a static asset (bundler-resolved, e.g.
          // webpack/Vite/CRA) is never an internal code dependency edge —
          // not resolving it to a JS/TS source file isn't an analysis
          // limitation, so it's intentionally not recorded as a gap.
          continue;
        }

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

      const resolvedAlias = resolver.resolve(
        sourceFile.getFilePath(),
        specifier
      );
      if (resolvedAlias) {
        relationshipCount += 1;
        const targetPath = toRelative(rootDir, resolvedAlias.getFilePath());
        const alias = matchAlias(specifier, aliases);
        const aliasSourceText = alias
          ? ` via alias '${alias.pattern}' defined in '${alias.source.filePath}'${
              alias.source.configKey ? ` (${alias.source.configKey})` : ""
            }`
          : "";
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
              description: `'${importerPath}' imports from '${specifier}', resolved${aliasSourceText} to '${targetPath}'.`,
            },
          ],
        });
        continue;
      }

      if (looksLikePathAlias(specifier)) {
        gaps.push({
          certainty: "unsupported",
          description: `Import '${specifier}' in '${importerPath}' appears to use a path alias, but no matching alias configuration (tsconfig/jsconfig 'paths', package.json 'imports', or a supported bundler/framework config) resolved it to a discovered source file.`,
          location: importerLocation,
        });
        continue;
      }

      // Bare specifiers (e.g. "react", "node:test") are external packages,
      // not internal dependency edges — recorded as a candidate external
      // reference (matched against declared package.json dependencies by
      // ./external-dependencies.ts) rather than as a gap.
      externalReferences.push({ specifier, importerPath, line });
    }
  }

  return { relationships, gaps, externalReferences };
}
