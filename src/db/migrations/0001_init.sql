-- repos: a GitHub repository Repo Lore knows about.
CREATE TABLE repos (
  id BIGSERIAL PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner, name)
);

-- analysis_runs: one immutable row per (owner, repo, commit_sha,
-- analyzer_version) (ADR-0005). `result` holds the full serialized `Lore`
-- (src/lore/model.ts) produced by that run; `status` matches
-- `AnalysisSnapshot['status']` ('completed' | 'partial' | 'failed') exactly,
-- so the same status vocabulary is used in the database and the app rather
-- than inventing a separate one. Analysis runs synchronously and
-- in-process (ADR-0004's revision) — a row is only inserted once a result
-- or failure exists, so no 'running'/'queued' status is needed yet; that's
-- reintroduced only if/when session 16's async dispatch requires a
-- persisted in-progress state.
CREATE TABLE analysis_runs (
  id BIGSERIAL PRIMARY KEY,
  repo_id BIGINT NOT NULL REFERENCES repos (id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  analyzer_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'failed')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id, commit_sha, analyzer_version)
);

-- Supports "render the latest completed/partial run for a repo"
-- (acceptance criterion 10) without a full table scan.
CREATE INDEX analysis_runs_repo_active_idx ON analysis_runs (repo_id, created_at DESC)
WHERE
  status IN ('completed', 'partial');
