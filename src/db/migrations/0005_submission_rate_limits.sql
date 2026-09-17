-- submission_rate_limits: rate-limits the home page's repository-submission
-- form per caller (identified by request IP — see
-- src/lib/request-identifier.ts), independent of the per-repo cooldown in
-- migration 0003. That cooldown only throttles repeat submissions of the
-- *same* repo; a single caller submitting many *different* repository URLs
-- in quick succession would never trip it, each one still costing a GitHub
-- API resolve (and, for a supported language, a full tarball
-- fetch/extraction) against the app's single shared GITHUB_TOKEN. One row
-- per caller, overwritten on every claimed attempt — not a history, just
-- the last time that caller was let through.
CREATE TABLE submission_rate_limits (
  identifier TEXT PRIMARY KEY,
  last_submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
