/**
 * Extracts external (third-party) dependencies from `package.json`'s
 * dependency fields and matches them against bare-specifier import
 * references (`./imports.ts`'s `ExternalReference[]`) to find which files
 * appear to use each one. Manifest declarations are `detected` (a direct
 * package.json field read); usage matches are also `detected`, since a bare
 * specifier resolving to a declared package name by exact prefix match is
 * unambiguous, unlike Python's name-normalization heuristic
 * (`../python/external-dependencies.ts`).
 *
 * No lockfile is parsed — `declaredVersion` is the manifest's own version
 * range/spec, never a resolved exact version (see ADR-0011).
 */

import type { ExternalDependency, ExternalDependencyScope } from "@/lore/model";
import type { ExternalReference } from "./imports";

export interface PackageJsonDependencyMeta {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const SCOPE_FIELDS: Array<{
  field: keyof PackageJsonDependencyMeta;
  scope: ExternalDependencyScope;
}> = [
  { field: "dependencies", scope: "direct" },
  { field: "devDependencies", scope: "dev" },
  { field: "peerDependencies", scope: "peer" },
  { field: "optionalDependencies", scope: "optional" },
];

/** The declared package name a bare specifier references — `"lodash/get"` -> `"lodash"`, `"@scope/pkg/sub"` -> `"@scope/pkg"`. */
export function packageNameFromSpecifier(specifier: string): string {
  const segments = specifier.split("/");
  if (specifier.startsWith("@") && segments.length >= 2) {
    return segments.slice(0, 2).join("/");
  }
  return segments[0];
}

export function extractExternalDependencies(
  pkg: PackageJsonDependencyMeta | undefined,
  externalReferences: ExternalReference[],
  projectId: string
): ExternalDependency[] {
  if (!pkg) return [];

  const dependencies = new Map<string, ExternalDependency>();
  let idCounter = 0;

  for (const { field, scope } of SCOPE_FIELDS) {
    const section = pkg[field];
    if (!section) continue;
    for (const [name, version] of Object.entries(section)) {
      // First-seen wins across fields (dependencies > dev > peer >
      // optional) — a package declared in more than one field is rare, and
      // "direct" is the most useful scope to surface when it happens.
      if (dependencies.has(name)) continue;
      idCounter += 1;
      dependencies.set(name, {
        id: `${projectId}-external-dep-${idCounter}`,
        projectId,
        name,
        declaredVersion: version,
        scope,
        registry: "npm",
        evidence: [
          {
            kind: "package-json-dependency-field",
            certainty: "detected",
            location: {
              filePath: "package.json",
              configKey: `${field}.${name}`,
            },
            description: `package.json declares "${name}": "${version}" under "${field}".`,
          },
        ],
        gaps: [],
      });
    }
  }

  for (const ref of externalReferences) {
    const dependency = dependencies.get(
      packageNameFromSpecifier(ref.specifier)
    );
    if (!dependency) continue;
    dependency.evidence.push({
      kind: "import-reference",
      certainty: "detected",
      location: { filePath: ref.importerPath, startLine: ref.line },
      description: `'${ref.importerPath}' imports '${ref.specifier}'.`,
    });
  }

  return [...dependencies.values()];
}
