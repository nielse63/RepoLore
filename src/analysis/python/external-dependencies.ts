/**
 * Extracts external (third-party) dependencies from `pyproject.toml`'s
 * declared dependency sections (`./project-config.ts`'s `DeclaredDependency[]`)
 * and matches them against unresolved absolute-import references
 * (`./imports.ts`'s `ExternalReference[]`) to find which files appear to use
 * each one.
 *
 * Unlike JS/TS's exact bare-specifier match, matching here is by normalized
 * name equality (case-insensitive, punctuation-insensitive) — Python import
 * names frequently differ from their PyPI distribution name (`PyYAML` is
 * imported as `yaml`, `beautifulsoup4` as `bs4`, ...), so a match is
 * `inferred`, never `detected`, and a declared dependency with no matched
 * import gets an honest `unknown` gap ("no usage detected") rather than
 * being labeled unused — the heuristic can't rule out real usage under a
 * differently-named import (see ADR-0011).
 */

import type { ExternalDependency } from "@/lore/model";
import type { DeclaredDependency } from "./project-config";
import type { ExternalReference } from "./imports";

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function extractExternalDependencies(
  declared: DeclaredDependency[],
  externalReferences: ExternalReference[],
  projectId: string
): ExternalDependency[] {
  const byNormalizedName = new Map<string, ExternalDependency>();
  let idCounter = 0;

  for (const dep of declared) {
    const key = normalize(dep.name);
    if (byNormalizedName.has(key)) continue; // First declaration wins for a given normalized name.
    idCounter += 1;
    byNormalizedName.set(key, {
      id: `${projectId}-external-dep-${idCounter}`,
      projectId,
      name: dep.name,
      declaredVersion: dep.versionSpec,
      scope: dep.scope,
      registry: "pypi",
      evidence: [
        {
          kind: "pyproject-dependency-declaration",
          certainty: "detected",
          location: { filePath: dep.sourceFile, configKey: dep.configKey },
          description: `${dep.sourceFile} declares dependency "${dep.name}"${
            dep.versionSpec ? ` (${dep.versionSpec})` : ""
          } at "${dep.configKey}".`,
        },
      ],
      gaps: [],
    });
  }

  const matchedKeys = new Set<string>();
  for (const ref of externalReferences) {
    const key = normalize(ref.topLevelName);
    const dependency = byNormalizedName.get(key);
    if (!dependency) continue;
    matchedKeys.add(key);
    dependency.evidence.push({
      kind: "import-reference",
      certainty: "inferred",
      location: { filePath: ref.importerPath, startLine: ref.line },
      description: `'${ref.importerPath}' imports '${ref.topLevelName}', matched by normalized name to declared dependency '${dependency.name}'.`,
    });
  }

  for (const [key, dependency] of byNormalizedName) {
    if (matchedKeys.has(key)) continue;
    dependency.gaps.push({
      certainty: "unknown",
      description: `No import in the analyzed source matched '${dependency.name}' by name. This doesn't necessarily mean it's unused — Python import names frequently differ from their declared package name.`,
      location: dependency.evidence[0]?.location,
    });
  }

  return [...byNormalizedName.values()];
}
