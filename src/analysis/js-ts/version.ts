/**
 * Bumped whenever a change to JS/TS extraction or derived-view logic should
 * invalidate prior conclusions (ADR-0005) — a new version naturally produces
 * new `analysis_runs` rows rather than overwriting or requiring a backfill
 * migration of old ones.
 */
export const JS_TS_ANALYZER_VERSION = "js-ts-v8";
