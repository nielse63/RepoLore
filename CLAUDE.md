# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 2 (scaffolding) is underway. Session 1 is complete: a real Next.js (App Router, TypeScript) app lives at the repo root, scaffolded with `create-next-app`. No test suite is configured yet (see session 15 in the implementation plan). See `docs/architecture/implementation-plan.md` for the exact next task and progress log.

- `npm run dev` — start the dev server (serves `/api/health` as a liveness-only check, no DB)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)

## Product

**Repo Lore** (always two words) builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence, without relying on tribal knowledge — at a stable URL (`/lore/{owner}/{repo}`). The MVP targets **orientation confidence**: within 15 minutes of opening a Lore, an experienced engineer should be able to identify probable entry points, major structural areas, important direct relationships, and a justified place to begin investigating a change. Full mission: `docs/product/mission.md`. `docs/product/mvp.md` is the source-of-truth MVP specification — treat every other product document as subordinate to it and update it if it conflicts.

Constraints that should shape any proposed feature or dependency (see `product-scope-guardian` below for the full checklist; full detail in `docs/product/mvp.md` and `docs/product/non-goals.md`):

- Maintained by one engineer as a side project (~5–8 hrs/week, never more than 10), targeting roughly $2,000 MRR.
- Initial customer: startups / small-to-medium engineering orgs.
- Initial supported ecosystem: TypeScript, JavaScript, and Python, sharing one language-neutral Lore model. React is framework-aware enrichment within the JavaScript/TypeScript analyzer, not a separate analyzer or product.
- No scheduled or automatic refresh in the MVP — analysis runs on submission and on manual re-analysis only.
- No health scores or generalized health findings in the MVP.
- Prefer managed services, standard libraries, deterministic analysis, and reversible decisions.
- Reject speculative scalability, enterprise requirements, and premature customization.
- AI explains evidence-backed analysis; it does not replace deterministic code analysis, and it is not required for the MVP.

## Architecture

First-slice architecture and the reasoning behind it live in `docs/architecture/decisions/` (ADR-0001 through ADR-0005): a single Next.js deployable (the worker entrypoint and job queue are deferred until a synchronous path proves insufficient — see ADR-0001 and ADR-0004), GitHub-tarball source acquisition with enforced extraction limits, syntactic (non-type-checked) ts-morph analysis for JavaScript/TypeScript, and analysis results keyed by `(owner, repo, commit_sha, analyzer_version)`. ADR-0003 currently scopes ts-morph analysis to JavaScript/TypeScript only; Python analysis needs its own ADR before that work begins (see `docs/architecture/implementation-plan.md`). Read these before proposing a different shape for ingestion, analysis, or job execution.

## Custom subagents

Two project-specific subagents are defined in `.claude/agents/` and should be invoked proactively when their trigger conditions apply:

- **`product-scope-guardian`** — use before adopting new infrastructure, integrations, frameworks, or major features. Evaluates proposals for mission alignment, MVP necessity, maintenance cost, operational risk, and simpler alternatives.
- **`analysis-integrity-reviewer`** — use after modifying analyzers, documentation generation, or AI explanations. Checks that factual claims are traceable to source, that deterministic findings are separated from AI inference/heuristics, and that uncertainty is surfaced using the Detected/Inferred/Unknown/Unsupported categories rather than hidden.

## Git Workflow

Do not commit, or offer to commit, any changes. Those will be performed manually by the user.
