# Repo Lore

> Repo Lore builds a living mental model of your software, so every engineer can understand it with confidence — without relying on tribal knowledge.

Paste a public GitHub repository URL and Repo Lore produces a stable, readable "lore" page for it at `/lore/{owner}/{repo}`: what the system does, its important concepts and boundaries, how its major pieces relate, where execution begins, and what to read first. The lore refreshes automatically against the repository's default branch, and every claim it makes links back to the source evidence it came from.

Repo Lore earns confidence through evidence, not through AI narration. Analysis is deterministic static analysis first (source code, configuration, and version-control metadata); AI, when introduced later, only explains and organizes findings that have already been established as fact — it never replaces the analysis itself.

## Status

Pre-implementation. This repository currently contains the product and architecture foundation only (see `docs/`); no application code exists yet. See `docs/architecture/implementation-plan.md` for the next steps and current progress.

## Initial scope

- Public GitHub repositories only (no auth, no private repos, no payments yet).
- TypeScript applications and libraries, plus React applications written in TypeScript.
- One deterministic vertical slice: submit a URL, get a lore page with a project summary, a "start here" list, a dependency map, entry points, and a small set of high-confidence health findings — all traceable to source.

See `docs/product/mission.md`, `docs/product/mvp.md`, and `docs/product/non-goals.md` for the full product foundation, and `docs/architecture/decisions/` for the technical decisions behind the first slice.

## Local development

Not yet available — the application has not been scaffolded. This section will be filled in during implementation session 1 (see `docs/architecture/implementation-plan.md`).
