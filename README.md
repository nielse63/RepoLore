# Repo Lore

> Repo Lore builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence — without relying on tribal knowledge.

Paste a public GitHub repository URL and Repo Lore produces a stable, readable "lore" page for it at `/lore/{owner}/{repo}`: what the repository contains, where to start reading and why, its major structural areas, probable entry points, and how those areas directly relate. Every important conclusion links back to the source evidence it came from and is labeled **Detected**, **Inferred**, **Unknown**, or **Unsupported**. The MVP does not refresh automatically — you can manually request a fresh analysis after the repository changes.

Repo Lore earns confidence through evidence, not AI narration. Analysis starts with deterministic source and dependency analysis, repository configuration and metadata, and explicit heuristics. AI is not required for the MVP; when introduced, it only explains and organizes findings that have already been established as fact — it never replaces the analysis itself.

## Status

Phase 2 (scaffolding) is underway. A Next.js (App Router, TypeScript) app lives at the repo root, and the shared, language-neutral Lore domain model (`src/lore/model.ts`) is defined — no language extractor, persistence, or UI reads from it yet. See `docs/architecture/implementation-plan.md` for the next task and progress log.

## Initial scope

- Public GitHub repositories only (no auth, no private repos, no payments yet).
- TypeScript, JavaScript, and Python applications and libraries, sharing one language-neutral Lore model. React is framework-aware enrichment within the JavaScript/TypeScript analyzer, not a separate product.
- One deterministic vertical slice: submit a URL, get a Lore page with repository orientation, a "Start Here" reading path, a major-area model, probable entry points and direct relationships, and evidence with explicit gaps — all traceable to source.

See `docs/product/mvp.md` for the full MVP specification, `docs/product/mission.md` and `docs/product/non-goals.md` for the broader product foundation, and `docs/architecture/decisions/` for the technical decisions behind the first slice.

## Local development

```
npm install
npm run dev    # start the dev server (serves /api/health as a liveness-only check, no DB)
npm run build  # production build
npm run start  # run the production build
npm run lint   # ESLint
```

No database, GitHub PAT, or hosting account is required yet — those are provisioned in the sessions that first need them (see `docs/architecture/implementation-plan.md`).
