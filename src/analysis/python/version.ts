/**
 * Bumped whenever a change to Python extraction or derived-view logic
 * should invalidate prior conclusions (ADR-0005) — a new version naturally
 * produces new `analysis_runs` rows rather than overwriting or requiring a
 * backfill migration of old ones.
 */
export const PYTHON_ANALYZER_VERSION = "python-v2";
