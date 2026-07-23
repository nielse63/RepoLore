/**
 * Public surface extraction: named exports reachable from a project's
 * library/runtime entry point(s), including re-exports (e.g.
 * `export { add } from "./math"`), using ts-morph's declaration resolution.
 */

import path from "node:path";
import type { SourceFile } from "ts-morph";
import type { EntryPoint, PublicContract } from "@/lore/model";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

const SURFACE_ENTRY_KINDS: ReadonlyArray<EntryPoint["kind"]> = [
  "library",
  "runtime",
  "public-export",
];

export function extractPublicSurface(
  entryPoints: EntryPoint[],
  sourceFiles: SourceFile[],
  rootDir: string,
): PublicContract[] {
  const contracts: PublicContract[] = [];
  const byRelativePath = new Map(
    sourceFiles.map((sf) => [toRelative(rootDir, sf.getFilePath()), sf]),
  );

  for (const entryPoint of entryPoints) {
    if (!SURFACE_ENTRY_KINDS.includes(entryPoint.kind)) continue;

    const entryFile = byRelativePath.get(entryPoint.location.filePath);
    if (!entryFile) continue;

    for (const [name, declarations] of entryFile.getExportedDeclarations()) {
      const declaration = declarations[0];
      const declaredIn = declaration
        ? toRelative(rootDir, declaration.getSourceFile().getFilePath())
        : entryPoint.location.filePath;

      contracts.push({
        id: `js-ts-public-${entryPoint.location.filePath}-${name}`,
        areaId: entryPoint.location.filePath,
        name,
        kind: "export",
        location: { filePath: entryPoint.location.filePath, symbolName: name },
        evidence: [
          {
            kind: "export-declaration",
            certainty: "detected",
            location: { filePath: declaredIn, symbolName: name },
            description:
              declaredIn === entryPoint.location.filePath
                ? `'${name}' is exported directly from entry point '${entryPoint.location.filePath}'.`
                : `'${name}' is exported from entry point '${entryPoint.location.filePath}', declared in '${declaredIn}'.`,
          },
        ],
      });
    }
  }

  return contracts;
}
