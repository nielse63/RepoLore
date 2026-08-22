-- history_entries: a cached History-page compute result per repo (docs/
-- architecture/decisions/0010-history-page-real-data-scope.md). Unlike
-- analysis_runs, this is a cache keyed only on repo_id (one row per repo,
-- overwritten on refresh), not an immutable per-commit record — recomputing
-- it means re-fetching and re-classifying commit diffs from GitHub, which
-- is deliberately not automatic (no scheduled refresh, matching the rest of
-- the app), so a stale-but-present cache is expected between manual
-- "Refresh history" actions.
CREATE TABLE history_entries (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
  computed_through_sha TEXT NOT NULL,
  entries JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id)
);

-- Mirrors migration 0003's `last_analysis_requested_at`: rate-limits the
-- manual "Refresh history" action independent of whether a refresh actually
-- changed anything.
ALTER TABLE repos ADD COLUMN last_history_requested_at TIMESTAMPTZ;
