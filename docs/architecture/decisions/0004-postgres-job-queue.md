# ADR-0004: Postgres-backed job table instead of Redis/BullMQ

## Status

Accepted, **implementation deferred** — see Revision below.

## Context

Analysis jobs need to be queued, claimed by a worker, retried on failure, and recovered if a worker crashes mid-job. This requires some form of job queue between the web process (which enqueues jobs on repo submission or manual re-analysis) and the worker process (which claims and runs them).

**Revision (product-scope review, 2026-07-22):** the MVP architecture (ADR-0001) runs a single worker — there is no concurrent-worker scenario yet, and no analysis code exists yet to generate real data on job duration or failure modes. Building `SELECT ... FOR UPDATE SKIP LOCKED` claiming and a stuck-job reaper now is hardening against failure modes that haven't been observed, ahead of proving the analyzer itself is useful. The design below remains the intended shape for when async dispatch is needed; **the first vertical slice instead runs analysis synchronously and in-process** (see `docs/architecture/implementation-plan.md`), with a `status` column on `repos`/`analysis_runs` sufficient to show queued/running/done/failed state. This table is built once a real reason appears — an HTTP timeout, a desire for non-blocking submission, or actually running more than one worker — not preemptively.

## Decision

Use a plain `analysis_jobs` table in the same managed Postgres database already used for `repos` and `analysis_runs`, with:

- `SELECT ... FOR UPDATE SKIP LOCKED` to let the worker claim a pending job without double-processing it if more than one worker instance is ever running.
- Status and `locked_at`/`attempts` columns to track job state.
- A stuck-job reaper: a periodic check that requeues or fails jobs claimed but not completed within a bound, so a worker crash (e.g., OOM from an oversized repo) doesn't permanently block that repo's lore from refreshing.

No Redis or BullMQ (or similar dedicated queue system) is introduced.

## Rationale

A SQL polling queue is a well-understood, boring pattern that avoids operating a second managed service. It's also a low-cost decision to reverse: the job table already defines the queue's public shape (enqueue / claim / complete / fail), so moving to Redis/BullMQ later — if polling frequency or throughput ever becomes a real bottleneck — would be a contained, isolated change behind that same interface, not a rearchitecture. An in-memory queue was not considered viable: it would lose jobs on every deploy or restart, which is unacceptable given the app redeploys often during active development.

## Consequences

- Managed Postgres provisioning is deferred until persistence is actually being built (see the resequenced implementation plan) — local Postgres (or SQLite, or no DB at all for the very first analyzer-proving session) is sufficient before that.
- The claim/lock and reaper logic are designed here but implemented only when the synchronous path is replaced with async dispatch — they are not a session-1–4 requirement.
- Job throughput is bounded by polling interval once built; this is acceptable for MVP volumes and is the traded-off cost of avoiding a second managed service.

## Alternatives considered

Redis + BullMQ was rejected for now as an additional managed service with no MVP-stage volume that justifies it. In-memory queueing was rejected as unsafe against process restarts.
