# Implementation plan — first vertical slice

This is a living tracking document. Update it at the end of every meaningful session: record what was completed, the exact next smallest task, and any unresolved decisions.

See `docs/product/mvp.md` for what the slice must do and `docs/architecture/decisions/` for why it's built this way.

## Architecture recap

Single Next.js (TypeScript) app on Fly.io or Railway, with `web` and `worker` entrypoints in one codebase (ADR-0001). Worker fetches GitHub tarballs (ADR-0002), analyzes with ts-morph syntactically (ADR-0003), and is coordinated through a Postgres job table (ADR-0004). Results are stored keyed by `(owner, repo, commit_sha, analyzer_version)` (ADR-0005).

## Acceptance criteria for the slice

1. Submitting a valid public GitHub URL enqueues a job and redirects to `/lore/{owner}/{repo}` showing a queued/running state.
2. An invalid URL or nonexistent repo produces a clear, honest error — no silent failure.
3. The worker resolves the default branch and HEAD commit SHA via an authenticated GitHub API call.
4. The worker fetches the repo tarball at that commit and extracts it under enforced size/file-count/time limits, rejecting path-traversal entries.
5. The worker detects whether the repo is a supported TS or TS+React project; unsupported repos get an honest "not supported" result, not a crash or fabricated analysis.
6. Source file discovery excludes `node_modules`, build/dist output, and other generated/vendored paths.
7. The extracted project model captures project type, source files, per-file imports/exports, internal dependency edges, probable entry points, and confidently-detected React components, via syntactic parsing.
8. Derived views are computed: summary, start-here list, dependency map, entry points, and a small set of high-confidence health findings.
9. Results are persisted keyed by `(owner, repo, commit_sha, analyzer_version)`; re-analysis at the same commit+analyzer version is idempotent.
10. `/lore/{owner}/{repo}` renders the latest completed run as plain tables/lists, shows the analyzed commit SHA and timestamp, and links each major claim back to the relevant file on GitHub.
11. A manual "re-analyze" action enqueues a new job, rate-limited.
12. A worker crash mid-job is detected and requeued/failed within a bounded time by the reaper.
13. A cron-triggered endpoint/script enqueues re-analysis for repos past a staleness threshold.
14. An adversarial fixture (oversized files, deep nesting, tar path-traversal attempt) fails safely within limits instead of hanging or crashing the worker.

## Fixture strategy

- `fixtures/ts-react-app/` — hand-built TS+React app: tsconfig with a path alias, one entry point, 2–3 components, one utility module, a `dist/`-like directory to verify exclusion.
- `fixtures/ts-library/` — small plain-TypeScript (non-React) library shape.
- `fixtures/unsupported/` — missing/unusual tsconfig, exercises the honest "partially supported" path.
- Manual (non-automated) sanity check against 1–2 small real public repos, pinned by commit SHA, once fixtures pass — pins to be chosen and recorded here at session 15/16.

## Sessions (~60–120 min each)

- [ ] 1. Scaffold Next.js + TypeScript app, lint/format config, env config, health-check route.
- [ ] 2. DB schema + migrations: `repos`, `analysis_runs`, `analysis_jobs`.
- [ ] 3. GitHub URL input, validation/normalization, GitHub API client (default branch + HEAD SHA), "submit repo" flow that enqueues a job.
- [ ] 4. Worker process skeleton: poll loop, `FOR UPDATE SKIP LOCKED` claim, status transitions, stuck-job reaper, structured logging.
- [ ] 5. Tarball fetch + safe extraction (size/file-count/time limits, path sanitization) into temp dir, with cleanup.
- [ ] 6. TS/React project detection (tsconfig, package.json deps) and config reading.
- [ ] 7. Source file discovery with exclusion rules.
- [ ] 8. ts-morph project model extraction: imports/exports, internal dependency edges, entry-point heuristics.
- [ ] 9. React component detection heuristics.
- [ ] 10. Derived views: summary, start-here, dependency map, entry points, health findings.
- [ ] 11. Persist `analysis_run`, idempotent on `(owner, repo, commit_sha, analyzer_version)`.
- [ ] 12. Render `/lore/{owner}/{repo}`: tables, commit SHA + timestamp, evidence links to GitHub.
- [ ] 13. Manual re-analysis action (rate-limited) + honest unsupported/failed states.
- [ ] 14. Cron-triggered refresh endpoint/script for stale repos.
- [ ] 15. Automated tests: analyzer correctness against fixtures, failure handling (malformed, oversized, path-traversal attempt).
- [ ] 16. Local dev docs, run-through against fixtures + 1–2 pinned public repos, self-review against mission/constraints (Phase 3 of the founding brief).

## Progress log

### 2026-07-22 — Phase 1 complete

Completed: product thesis, risk identification, architecture decision (single deployable + worker, tarball acquisition, ts-morph syntactic analysis, Postgres job queue, result keying), five ADRs, acceptance criteria, fixture strategy, and this session breakdown. Architecture validated against solo-maintainer constraints via `product-scope-guardian`. No application code written yet.

**Next smallest task:** Session 1 — scaffold the Next.js + TypeScript app (lint/format config, env config, a health-check route), nothing else.

**Unresolved decisions (deferred on purpose, not blocking):** exact hosting provider (Fly.io vs. Railway) and managed Postgres provider (Neon vs. Railway Postgres) — pick either at session 1/2, both are reversible.
