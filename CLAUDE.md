# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phase 2 (scaffolding) is underway, through session 14 of `docs/architecture/implementation-plan.md`. A real Next.js (App Router, TypeScript) app lives at the repo root. Automated tests are both unit (Jest, one spec file per analyzer module, gating every session's work) and functional (Playwright, driving real pages in a browser — currently the home page's client-side URL validation and the 404 page); see `npm run test` and `npm run test:e2e` below. See `docs/architecture/implementation-plan.md` for the exact next task and progress log.

- `npm run dev` — start the dev server (serves `/api/health` as a liveness-only check, no DB)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npm run test` — Jest unit test suite
- `npm run test:coverage` — Jest unit test suite with a coverage report
- `npm run test:e2e` — Playwright functional/UI test suite

## Testing

Every source code change must leave the test suites reflecting the new behavior, not just passing against it:

- **New code** (a module, component, route, or API handler with no existing coverage): add a Jest spec file (analyzers, one spec file per module — see `docs/architecture/implementation-plan.md`) and, for anything user-facing, a Playwright spec exercising the real page.
- **Changed code**: update the existing unit and/or e2e tests that cover it so they assert the new behavior — don't leave assertions describing the old behavior passing coincidentally, and don't just add a new test alongside a now-stale one.
- **Removed code**: delete the tests (and fixtures) that existed only to cover it. Don't leave dead specs testing code that no longer exists.
- Run `npm run test` and, when the change touches a page or user flow, `npm run test:e2e` before considering the change complete.
- If a change is genuinely untestable (e.g. pure config, docs-only), state that explicitly rather than silently skipping test updates.

## Product

**Repo Lore** (always two words) builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence, without relying on tribal knowledge — at a stable URL (`/lore/{owner}/{repo}`). Repo Lore targets **orientation confidence**: within 15 minutes of opening a Lore, an experienced engineer should be able to identify probable entry points, major structural areas, important direct relationships, and a justified place to begin investigating a change. Full mission: `docs/product/mission.md`; explicit non-goals and scope boundaries: `docs/product/non-goals.md`.

Constraints that should shape any proposed feature or dependency (see `product-scope-guardian` below for the full checklist; full detail in `docs/product/mission.md` and `docs/product/non-goals.md`):

- Maintained by one engineer as a side project (~5–8 hrs/week, never more than 10), targeting roughly $2,000 MRR.
- Initial customer: startups / small-to-medium engineering orgs.
- Initial supported ecosystem: TypeScript, JavaScript, and Python, sharing one language-neutral Lore model. React is framework-aware enrichment within the JavaScript/TypeScript analyzer, not a separate analyzer or product.
- No headless scheduled refresh (cron, webhooks, polling with no visitor) — analysis runs on submission, on manual re-analysis, or on a background re-analysis attempt pull-triggered by an actual page view of a stale (>1 day) repository, rate-limited per repository via the existing manual re-analysis claim (ADR-0013).
- No health scores or generalized health findings.
- Prefer managed services, standard libraries, deterministic analysis, and reversible decisions.
- Reject speculative scalability, enterprise requirements, and premature customization.
- AI explains evidence-backed analysis; it does not replace deterministic code analysis, and it is not required.

## Design

`docs/designs/` holds UI mockup images (`architecture.png`, `change-impact.png`, `data-flow.png`, `dependencies.png`, `evidence-library.png`, `history.png`, `home.png`, `repository-overview.png`, `repository-settings.png`, `search.png`, `systems.png`, `systems-subview.png`), each representing a distinct UI view. **Any UI work (layout, components, styling, information hierarchy, navigation) must be based on these mockups** — check the relevant image(s) before implementing or changing a view. File names do not map directly to URL routes; match a mockup to the view it depicts by its contents, not by assuming its filename is a path.

## Architecture

First-slice architecture and the reasoning behind it live in `docs/architecture/decisions/` (ADR-0001 through ADR-0006): a single Next.js deployable (the worker entrypoint and job queue are deferred until a synchronous path proves insufficient — see ADR-0001 and ADR-0004), GitHub-tarball source acquisition with enforced extraction limits, syntactic (non-type-checked) ts-morph analysis for JavaScript/TypeScript (ADR-0003), syntactic tree-sitter-python analysis for Python (ADR-0006), and analysis results keyed by `(owner, repo, commit_sha, analyzer_version)` (ADR-0005). Both language extractors' derived views (Start Here, major areas) share one language-neutral core (`src/analysis/shared/derive-views.ts`); real end-to-end analysis submissions are still JS/TS-only pending a project-language-detection dispatch (see `docs/architecture/implementation-plan.md`, session 13's log). Read these before proposing a different shape for ingestion, analysis, or job execution.

## Custom subagents

Two project-specific subagents are defined in `.claude/agents/` and should be invoked proactively when their trigger conditions apply:

- **`product-scope-guardian`** — use before adopting new infrastructure, integrations, frameworks, or major features. Evaluates proposals for mission alignment, necessity, maintenance cost, operational risk, and simpler alternatives.
- **`analysis-integrity-reviewer`** — use after modifying analyzers, documentation generation, or AI explanations. Checks that factual claims are traceable to source, that deterministic findings are separated from AI inference/heuristics, and that uncertainty is surfaced using the Detected/Inferred/Unknown/Unsupported categories rather than hidden.

## Git Workflow

Do not commit, or offer to commit, any changes. Those will be performed manually by the user.

## Workflow

With each new update, make sure to update the `README.md` file to include information regarding features, development lifecycle, deployment, and any other pertinent changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
