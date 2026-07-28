/**
 * Composes the `analyzer_version` string persisted on an `analysis_runs` row
 * (ADR-0005) for a real submission, where the *set* of analyzers run now
 * varies per repository (ADR-0007). Deterministic in the selected
 * analyzers' order (always sorted) so the same repository, at the same
 * commit, choosing the same analyzer set, always keys to the same version —
 * ADR-0005's idempotency depends on this being stable, not just unique.
 *
 * Bump `DISPATCH_VERSION` whenever the detection/selection logic itself
 * changes (e.g. `MIN_LANGUAGE_SHARE_FOR_ANALYSIS`, the GitHub-language-name
 * mapping) in a way that could change which analyzers a given repository's
 * language breakdown selects — a new version naturally produces new
 * `analysis_runs` rows rather than requiring a backfill.
 */

import { JS_TS_ANALYZER_VERSION } from "@/analysis/js-ts/version";
import { PYTHON_ANALYZER_VERSION } from "@/analysis/python/version";
import type { SupportedAnalyzer } from "./detect-languages";

export const DISPATCH_VERSION = "dispatch-v1";

const ANALYZER_VERSIONS: Record<SupportedAnalyzer, string> = {
  "js-ts": JS_TS_ANALYZER_VERSION,
  python: PYTHON_ANALYZER_VERSION,
};

/**
 * `selectedAnalyzers` empty means no supported analyzer was selected
 * (ADR-0007's explicit unsupported-language state) — still versioned, so a
 * later dispatch-logic change (e.g. a lowered threshold, or a new supported
 * language) correctly produces a fresh run rather than reusing a stale
 * "unsupported" verdict.
 */
export function buildAnalyzerVersion(
  selectedAnalyzers: SupportedAnalyzer[]
): string {
  if (selectedAnalyzers.length === 0) {
    return `${DISPATCH_VERSION}:unsupported`;
  }
  const versions = [...selectedAnalyzers]
    .sort()
    .map((analyzer) => ANALYZER_VERSIONS[analyzer]);
  return `${DISPATCH_VERSION}:${versions.join("+")}`;
}
