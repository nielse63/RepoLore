# ADR-0001: Single deployable with a separate worker entrypoint, not split services

## Status

Accepted

## Context

The analysis pipeline (fetch a repo, extract it, walk its AST) is CPU/memory-heavy and long-running relative to a typical web request, so it can't simply run inline inside an HTTP handler on a serverless platform like Vercel without hitting execution-time limits. Two shapes were considered:

- **A.** One Next.js (TypeScript) codebase and deploy, with two process entrypoints — `web` (serves the app/API) and `worker` (polls the job queue and runs analysis) — deployed together on a Node-friendly host (Fly.io or Railway).
- **B.** A Vercel-hosted Next.js frontend/API plus a separate analysis worker service (e.g., on Fly.io), coordinated through shared Postgres.

## Decision

Use **A**: a single deployable application with a separate worker process entrypoint in the same codebase.

## Rationale

This directly matches the project's stated engineering principle of preferring one deployable application plus a simple background-job boundary over microservices. For a solo maintainer working 5–8 hours/week, one deploy pipeline, one log stream, and one environment to reason about is a larger reduction in operational burden than anything Vercel's DX would add. Splitting into two services (B) would mean two things to deploy, monitor, and keep in sync for no corresponding feature benefit at this stage.

## Consequences

- Hosting must support a long-running Node process, not just serverless functions — rules out Vercel as the primary host. Provisioning a host is not required to start local development. **Revision (see `docs/architecture/implementation-plan.md`, session 17's 2026-08-25 log entry):** Render (web) with Neon (Postgres) was chosen over Fly.io/Railway, which had free tiers when this ADR was written but do not anymore; Render still satisfies this consequence's directional requirement (a real long-running container, not a serverless function).
- **Revision (see ADR-0004):** the first vertical slice runs analysis synchronously, in-process, directly from the request/action that triggers it — there is no separate `worker` entrypoint or job queue yet. The "web + worker" split described here is the target shape once async dispatch is justified (see ADR-0004's deferral), not a session-1 requirement. This keeps the directional decision (don't assume serverless; assume a long-running process is available) while not building the worker process before there's a queue for it to serve.
- If load or UX later requires non-blocking submission, introducing the worker entrypoint is a straightforward additive change (a new process reading from the job table added in ADR-0004), not a rearchitecture.

## Alternatives considered

Approach B (split Vercel frontend + separate worker service) was rejected for adding operational surface area (two deployables, two places for something to break) that isn't justified by any MVP requirement.
