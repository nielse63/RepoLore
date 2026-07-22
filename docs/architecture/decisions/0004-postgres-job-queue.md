# ADR-0004: Postgres-backed job table instead of Redis/BullMQ

## Status

Accepted

## Context

Analysis jobs need to be queued, claimed by a worker, retried on failure, and recovered if a worker crashes mid-job. This requires some form of job queue between the web process (which enqueues jobs on repo submission or manual re-analysis) and the worker process (which claims and runs them).

## Decision

Use a plain `analysis_jobs` table in the same managed Postgres database already used for `repos` and `analysis_runs`, with:

- `SELECT ... FOR UPDATE SKIP LOCKED` to let the worker claim a pending job without double-processing it if more than one worker instance is ever running.
- Status and `locked_at`/`attempts` columns to track job state.
- A stuck-job reaper: a periodic check that requeues or fails jobs claimed but not completed within a bound, so a worker crash (e.g., OOM from an oversized repo) doesn't permanently block that repo's lore from refreshing.

No Redis or BullMQ (or similar dedicated queue system) is introduced.

## Rationale

A SQL polling queue is a well-understood, boring pattern that avoids operating a second managed service. It's also a low-cost decision to reverse: the job table already defines the queue's public shape (enqueue / claim / complete / fail), so moving to Redis/BullMQ later — if polling frequency or throughput ever becomes a real bottleneck — would be a contained, isolated change behind that same interface, not a rearchitecture. An in-memory queue was not considered viable: it would lose jobs on every deploy or restart, which is unacceptable given the app redeploys often during active development.

## Consequences

- Managed Postgres (e.g., Neon or Railway Postgres) is a hard dependency from the first implementation session; this is consistent with also using it for `repos`/`analysis_runs`, so no new service is added purely for the queue.
- The claim/lock and reaper logic must be implemented correctly from the start (session 4) since they are what make this safe under worker crashes — they are not deferred hardening.
- Job throughput is bounded by polling interval; this is acceptable for MVP volumes and is the traded-off cost of avoiding a second managed service.

## Alternatives considered

Redis + BullMQ was rejected for now as an additional managed service with no MVP-stage volume that justifies it. In-memory queueing was rejected as unsafe against process restarts.
