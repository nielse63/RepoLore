/**
 * Enriches already-extracted `ExternalDependency` records with a
 * registry-sourced description and keywords (ADR-0011), mutating each entry
 * in place.
 * Deliberately a separate, post-extraction orchestration step (called from
 * `src/analysis/analyze-and-persist.ts`) rather than folded into the
 * language extractors themselves: extraction stays local/deterministic,
 * while this step is the one place that talks to an external network
 * service, so it can be reasoned about, capped, and failed independently.
 *
 * Bounded on three axes so one dependency-heavy repository can't blow up
 * analysis time: a per-request timeout (`./npm.ts`/`./pypi.ts`), a
 * concurrency cap, and a soft cap on the total number of packages looked up
 * per run. A lookup failure (timeout, network error, 404, missing field) or
 * a dependency past the soft cap gets an honest `unknown` gap rather than
 * blocking or silently omitting the dependency — no cross-repo cache is
 * kept in v1 (see the ADR).
 */

import type { ExternalDependency, Gap } from "@/lore/model";
import { fetchNpmPackageMetadata } from "./npm";
import { fetchPypiPackageMetadata } from "./pypi";

const FETCH_CONCURRENCY = 5;
const MAX_DEPENDENCIES_TO_ENRICH = 100;

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await fn(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker)
  );
}

function unavailableGap(dependency: ExternalDependency): Gap {
  const registryLabel = dependency.registry === "npm" ? "npm" : "PyPI";
  return {
    certainty: "unknown",
    description: `Could not fetch a description for "${dependency.name}" from the ${registryLabel} registry.`,
    location: dependency.evidence[0]?.location,
  };
}

export async function enrichExternalDependencyDescriptions(
  dependencies: ExternalDependency[]
): Promise<void> {
  const toFetch = dependencies.slice(0, MAX_DEPENDENCIES_TO_ENRICH);

  await mapWithConcurrency(toFetch, FETCH_CONCURRENCY, async (dependency) => {
    const metadata =
      dependency.registry === "npm"
        ? await fetchNpmPackageMetadata(dependency.name)
        : await fetchPypiPackageMetadata(dependency.name);

    if (metadata) {
      if (metadata.description) {
        dependency.description = metadata.description;
        dependency.descriptionSource = dependency.registry;
      }
      if (metadata.keywords) {
        dependency.keywords = metadata.keywords;
      }
      if (!metadata.description) {
        dependency.gaps.push(unavailableGap(dependency));
      }
    } else {
      dependency.gaps.push(unavailableGap(dependency));
    }
  });

  for (const dependency of dependencies.slice(MAX_DEPENDENCIES_TO_ENRICH)) {
    dependency.gaps.push({
      certainty: "unknown",
      description: `Description lookup skipped: more than ${MAX_DEPENDENCIES_TO_ENRICH} external dependencies were declared in this repository.`,
      location: dependency.evidence[0]?.location,
    });
  }
}
