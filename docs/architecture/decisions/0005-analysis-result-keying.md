# ADR-0005: Analysis results keyed by (owner, repo, commit_sha, analyzer_version)

## Status

Accepted

## Context

Repo Lore must be able to: regenerate a lore page's underlying analysis when the analyzer's logic changes (without deploying a migration for every historical repo), avoid redundant work when re-analysis is triggered at a commit that's already been analyzed by the current analyzer, and always know exactly which commit and analyzer version produced what's on screen.

## Decision

Key every `analysis_runs` row by the tuple `(owner, repo, commit_sha, analyzer_version)`. A run is a completed, immutable record of what a specific analyzer version produced for a specific commit. The lore page renders the latest completed run for a repo (by commit recency), and `analyzer_version` is bumped whenever analysis logic changes in a way that should invalidate prior conclusions.

## Rationale

This key makes the system idempotent by construction: re-running analysis at a commit+analyzer-version that already has a completed run is a no-op (or returns the existing result) rather than creating a duplicate. It also makes analyzer changes safe to ship — after a version bump, old runs remain as a historical record under their original version, and new analysis naturally produces new rows without needing a backfill migration. This is a foundational data-model decision: changing the key later would require a migration touching every stored analysis, which is precisely the kind of costly-to-reverse decision this ADR process exists for.

## Consequences

- `analysis_jobs` and `analysis_runs` both carry this tuple (or enough of it — a job targets `owner, repo` and resolves `commit_sha` at execution time, tagging the run with the `analyzer_version` active when it ran).
- Displaying "last analyzed commit and analysis timestamp" (a stated MVP requirement) falls out directly from this key with no extra bookkeeping.
- Storage grows with every analyzer version bump × every analyzed commit; this is acceptable at MVP scale and can be pruned later (e.g., retain only the latest run per analyzer version per repo) without changing the key itself.

## Alternatives considered

Keying only by `(owner, repo)` (latest-wins, overwritten in place) was rejected: it would make analyzer version changes destructive to historical data and complicate safely rolling out analyzer changes, for no corresponding simplicity benefit given Postgres already models this cleanly as an append-only table.
