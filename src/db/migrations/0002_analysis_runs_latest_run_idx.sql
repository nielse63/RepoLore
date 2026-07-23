-- Session 9's partial index assumed "latest run" queries would always
-- filter to completed/partial. Session 10's actual `/lore/{owner}/{repo}`
-- page needs the latest run regardless of status — a repo whose most recent
-- attempt failed must still render that failure honestly (acceptance
-- criterion 2), not fall through to "never analyzed." A partial index can't
-- serve an unfiltered query, so replace it with a full index on the same
-- leading columns, which serves both the filtered and unfiltered shape.
DROP INDEX analysis_runs_repo_active_idx;

CREATE INDEX analysis_runs_repo_latest_idx ON analysis_runs (repo_id, created_at DESC);
