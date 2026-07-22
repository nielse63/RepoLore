# Implementation plan — first vertical slice

This is a living tracking document. Update it at the end of every meaningful session: record what was completed, the exact next smallest task, and any unresolved decisions.

See `docs/product/mvp.md` for what the slice must do and `docs/architecture/decisions/` for why it's built this way.

## Architecture recap

Single Next.js (TypeScript) app, deployed on Fly.io or Railway once a public deployment is needed (ADR-0001). The first slice runs analysis **synchronously and in-process** — no separate worker entrypoint or job queue yet; that design is specified in ADR-0004 but its implementation is deferred until there's a concrete reason (see "Sequencing" below). Source acquisition uses GitHub tarballs (ADR-0002), analysis uses ts-morph syntactically (ADR-0003), and results are keyed by `(owner, repo, commit_sha, analyzer_version)` (ADR-0005) once persistence is built.

## Sequencing (revised 2026-07-22 after product-scope review)

The original session order built acquisition, persistence, and async-job plumbing (sessions 2–5 below in the old plan) before any code proved that syntactic ts-morph analysis actually produces a useful lore — the one genuinely unproven part of the product. A `product-scope-guardian` review flagged this as solving concurrency/crash-recovery problems the single-worker MVP doesn't have yet, ahead of derisking the core bet, and recommended reordering so the analyzer is proven against local fixtures first, with acquisition/persistence/async layered in only once each is actually needed. This plan reflects that reordering. Managed Postgres provisioning, hosting account setup, and GitHub PAT provisioning are each deferred to the session that first needs them, not front-loaded into session 1.

## Acceptance criteria for the slice

1. Submitting a valid public GitHub URL analyzes it and shows the result at `/lore/{owner}/{repo}` (synchronously for the first slice; may show a brief loading state).
2. An invalid URL or nonexistent repo produces a clear, honest error — no silent failure.
3. The app resolves the default branch and HEAD commit SHA via an authenticated GitHub API call.
4. The app fetches the repo tarball at that commit and extracts it under enforced size/file-count/time limits, rejecting path-traversal entries.
5. The app detects whether the repo is a supported TS or TS+React project; unsupported repos get an honest "not supported" result, not a crash or fabricated analysis.
6. Source file discovery excludes `node_modules`, build/dist output, and other generated/vendored paths.
7. The extracted project model captures project type, source files, per-file imports/exports, internal dependency edges, probable entry points, and confidently-detected React components, via syntactic parsing.
8. Derived views are computed: summary, start-here list, dependency map, entry points, and a small set of high-confidence health findings.
9. Results are persisted keyed by `(owner, repo, commit_sha, analyzer_version)`; re-analysis at the same commit+analyzer version is idempotent.
10. `/lore/{owner}/{repo}` renders the latest completed run as plain tables/lists, shows the analyzed commit SHA and timestamp, and links each major claim back to the relevant file on GitHub.
11. A manual "re-analyze" action re-runs analysis, rate-limited.
12. A cron-triggered endpoint/script enqueues re-analysis for repos past a staleness threshold, once deployed.
13. An adversarial fixture (oversized files, deep nesting, tar path-traversal attempt) fails safely within limits instead of hanging or crashing the process.

Async dispatch (job queue, worker process, crash reaper — ADR-0004) is intentionally not an acceptance criterion for this slice; it's added once synchronous analysis demonstrably needs to become non-blocking.

## Fixture strategy

- `fixtures/ts-react-app/` — hand-built TS+React app: tsconfig with a path alias, one entry point, 2–3 components, one utility module, a `dist/`-like directory to verify exclusion.
- `fixtures/ts-library/` — small plain-TypeScript (non-React) library shape.
- `fixtures/unsupported/` — missing/unusual tsconfig, exercises the honest "partially supported" path.
- Manual (non-automated) sanity check against 1–2 small real public repos, pinned by commit SHA, once fixtures pass — pins to be chosen and recorded here later in the plan.

## Sessions (~60–120 min each)

- [ ] 1. Scaffold Next.js + TypeScript app, lint/format config, minimal local env config, liveness-only health-check route (no DB, no PAT, no hosting decisions).
- [ ] 2. Build the three local fixture repos; get ts-morph reading a fixture directly from local disk, with source file discovery + exclusion rules.
- [ ] 3. ts-morph project model extraction against local fixtures: imports/exports, internal dependency edges, entry-point heuristics, React component detection.
- [ ] 4. Derived views against local fixtures: summary, start-here, dependency map, entry points, health findings — rendered on a plain unstyled page. This is the session that proves or disproves the core "wow moment."
- [ ] 5. GitHub URL input, validation/normalization, GitHub API client (default branch + HEAD SHA) — first use of a GitHub PAT.
- [ ] 6. Tarball fetch + safe extraction (size/file-count/time limits, path sanitization) into temp dir, with cleanup; swap the analyzer's input from local fixtures to a fetched repo.
- [ ] 7. DB schema + migrations: `repos`, `analysis_runs` (local Postgres or SQLite is enough; managed provider not needed yet).
- [ ] 8. Persist `analysis_run`, idempotent on `(owner, repo, commit_sha, analyzer_version)`.
- [ ] 9. Render `/lore/{owner}/{repo}`: tables, commit SHA + timestamp, evidence links to GitHub, reading from persisted results.
- [ ] 10. Manual re-analysis action (rate-limited) + honest unsupported/failed states.
- [ ] 11. Automated tests: analyzer correctness against fixtures, failure handling (malformed, oversized, path-traversal attempt).
- [ ] 12. _(Only if needed by then)_ Async dispatch: `analysis_jobs` table, worker entrypoint, `FOR UPDATE SKIP LOCKED` claim, stuck-job reaper (ADR-0004's deferred design).
- [ ] 13. Cron-triggered refresh endpoint/script for stale repos.
- [ ] 14. Deploy: choose hosting (Fly.io/Railway) and managed Postgres provider (Neon/Railway), wire secrets, first public deploy.
- [ ] 15. Local dev docs, run-through against fixtures + 1–2 pinned public repos, self-review against mission/constraints (Phase 3 of the founding brief).

## Progress log

### 2026-07-22 — Phase 1 complete

Completed: product thesis, risk identification, architecture decision (single deployable + worker, tarball acquisition, ts-morph syntactic analysis, Postgres job queue, result keying), five ADRs, acceptance criteria, fixture strategy, and session breakdown. Architecture validated against solo-maintainer constraints via `product-scope-guardian`. No application code written yet.

### 2026-07-22 — Scope review and resequencing

A second `product-scope-guardian` review of the completed foundation found the original session order (DB + job queue + worker + tarball acquisition, sessions 2–5) front-loaded distributed-systems plumbing before any code proved the analyzer itself is useful — inverting the "smallest end-to-end slice" principle. Revised ADR-0001 and ADR-0004 to mark the worker/job-queue design as deferred-until-needed rather than a session-1–4 requirement; revised ADR-0002 to move PAT provisioning to the session that first calls the GitHub API. Resequenced sessions so the analyzer is proven against local fixtures (sessions 2–4) before acquisition (5–6), persistence (7–9), and before async dispatch/hosting/deploy (12–14, now explicitly conditional/later). No product requirement changed — only build order and what's provisioned when.

### 2026-07-22 — Session 1 complete

Scaffolded the Next.js (TypeScript) app: `create-next-app` with App Router, TypeScript, ESLint; added `.env.example` (empty for now — no secrets needed yet); added a liveness-only `/api/health` route returning `{ status: "ok" }` with no DB check. Verified locally: `npm run build` succeeds, `npm run dev` serves `/api/health` with a 200 response. Repository is runnable (`npm install && npm run dev`).

**Next smallest task:** Session 2 — create `fixtures/ts-react-app/`, `fixtures/ts-library/`, and `fixtures/unsupported/`, and get ts-morph reading one fixture from local disk with source-file discovery and exclusion rules (no GitHub, no DB).

**Unresolved decisions (deferred on purpose, not blocking):** exact hosting provider (Fly.io vs. Railway) and managed Postgres provider (Neon vs. Railway Postgres) — now deferred to session 14 (deploy), not session 1/2.
