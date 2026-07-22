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

- Hosting must support a long-running Node process, not just serverless functions — rules out Vercel as the primary host; Fly.io or Railway is used instead.
- The worker must not run inline inside a web request handler; analysis is always dispatched through the job queue (see ADR-0004), so a slow or wedged analysis can't block request handling.
- If load ever requires scaling the worker independently of the web process, that's a straightforward change (separate process count/scaling on the same host) rather than a rearchitecture.

## Alternatives considered

Approach B (split Vercel frontend + separate worker service) was rejected for adding operational surface area (two deployables, two places for something to break) that isn't justified by any MVP requirement.
