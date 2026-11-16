import type { Language, Lore } from "@/lore/model";

export interface AnalysisSources {
  languages: Language[];
  frameworks: string[];
  /** Manifests that declared at least one external dependency, e.g. `package.json`. */
  manifests: string[];
}

/**
 * What a Lore's findings were derived from, for the Analysis dialog: the
 * languages and frameworks detected across every project (a mixed-language
 * repository can have more than one, ADR-0007) and the manifests whose
 * dependency declarations were read. Manifests come from declaration
 * evidence only — an `import-reference` points at a source file, not a
 * manifest. Each list is de-duplicated and sorted.
 */
export function analysisSources(
  lore: Pick<Lore, "projects" | "externalDependencies">
): AnalysisSources {
  const sorted = <T extends string>(values: Iterable<T>) =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b));

  return {
    languages: sorted(lore.projects.flatMap((p) => p.languages)),
    frameworks: sorted(lore.projects.flatMap((p) => p.frameworks)),
    manifests: sorted(
      lore.externalDependencies.flatMap((d) =>
        d.evidence
          .filter((e) => e.kind !== "import-reference" && e.location)
          .map((e) => e.location!.filePath)
      )
    ),
  };
}
