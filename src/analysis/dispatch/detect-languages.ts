/**
 * Decides which analyzer(s) (ADR-0007) a repository's GitHub-reported
 * byte-weighted language breakdown warrants running. Pure and synchronous —
 * takes the already-fetched `fetchRepositoryLanguages` result
 * (`@/github/client`), never calls the network itself, so it's trivial to
 * unit test against fixed inputs.
 */

export type SupportedAnalyzer = "js-ts" | "python";

/** GitHub linguist language names credited to each supported analyzer group. */
const ANALYZER_LANGUAGE_NAMES: Record<SupportedAnalyzer, readonly string[]> = {
  "js-ts": ["JavaScript", "TypeScript"],
  python: ["Python"],
};

/**
 * A language group must clear this share of the repository's total
 * classified bytes to have its analyzer run — comfortably above incidental
 * scaffolding (a lone build script) and comfortably below a genuine
 * secondary language doing real work. Disclosed, tunable default, not a
 * load-bearing design commitment — see
 * `docs/architecture/decisions/0007-language-detection-dispatch.md`.
 */
export const MIN_LANGUAGE_SHARE_FOR_ANALYSIS = 0.1;

export interface LanguageShare {
  /** GitHub's own linguist language name, e.g. "Python". */
  language: string;
  bytes: number;
  /** Fraction of the repository's total classified bytes, 0-1. */
  share: number;
}

export interface AnalyzerSelection {
  analyzer: SupportedAnalyzer;
  share: number;
}

export interface LanguageDetectionResult {
  /** Analyzer groups clearing the threshold, sorted by descending share. */
  selectedAnalyzers: AnalyzerSelection[];
  /** Every GitHub-reported language, sorted by descending share — used for diagnostics/messaging even when unsupported. */
  languageShares: LanguageShare[];
  /** True when at least one supported analyzer was selected. */
  supported: boolean;
}

/**
 * Selects which analyzer(s) to run from a repository's GitHub `languages`
 * response (raw bytes per language, as returned by
 * `fetchRepositoryLanguages`). Returns `supported: false` (with an empty
 * `selectedAnalyzers`) when nothing clears `MIN_LANGUAGE_SHARE_FOR_ANALYSIS`
 * — including when GitHub reports no languages at all (an empty
 * repository).
 */
export function detectLanguages(
  languageBytes: Record<string, number>
): LanguageDetectionResult {
  const totalBytes = Object.values(languageBytes).reduce((a, b) => a + b, 0);

  const languageShares: LanguageShare[] = Object.entries(languageBytes)
    .map(([language, bytes]) => ({
      language,
      bytes,
      share: totalBytes > 0 ? bytes / totalBytes : 0,
    }))
    .sort((a, b) => b.share - a.share);

  const selectedAnalyzers: AnalyzerSelection[] = (
    Object.keys(ANALYZER_LANGUAGE_NAMES) as SupportedAnalyzer[]
  )
    .map((analyzer) => {
      const bytes = ANALYZER_LANGUAGE_NAMES[analyzer].reduce(
        (sum, name) => sum + (languageBytes[name] ?? 0),
        0
      );
      return { analyzer, share: totalBytes > 0 ? bytes / totalBytes : 0 };
    })
    .filter((entry) => entry.share >= MIN_LANGUAGE_SHARE_FOR_ANALYSIS)
    .sort((a, b) => b.share - a.share);

  return {
    selectedAnalyzers,
    languageShares,
    supported: selectedAnalyzers.length > 0,
  };
}
