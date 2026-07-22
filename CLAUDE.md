# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository has a product and architecture foundation (see `docs/`) but no application code yet — no package manifest, build system, linter, or test suite exists. Do not assume any exist. Phase 2 (scaffolding) starts at implementation session 1; see `docs/architecture/implementation-plan.md` for the exact next task and progress log. Once a toolchain is added, this file should be updated with the actual build/lint/test commands.

## Product

Repo Lore (referred to as **Repo Lore** in the subagents below) builds an automatically refreshed, evidence-backed "lore" of a repository at a stable URL (`/lore/{owner}/{repo}`), helping an engineer build an accurate mental model of an unfamiliar codebase within one day, without relying on tribal knowledge. Full mission: `docs/product/mission.md`.

Constraints that should shape any proposed feature or dependency (see `product-scope-guardian` below for the full checklist; full detail in `docs/product/mvp.md` and `docs/product/non-goals.md`):

- Maintained by one engineer as a side project (~5–8 hrs/week, never more than 10).
- Initial customer: startups / small-to-medium engineering orgs.
- Initial supported ecosystem: TypeScript and React.
- Prefer managed services, standard libraries, deterministic analysis, and reversible decisions.
- Reject speculative scalability, enterprise requirements, and premature customization.
- AI explains evidence-backed analysis; it does not replace deterministic code analysis.

## Architecture

First-slice architecture and the reasoning behind it live in `docs/architecture/decisions/` (ADR-0001 through ADR-0005): a single Next.js deployable with a separate worker entrypoint, GitHub-tarball source acquisition with enforced extraction limits, syntactic (non-type-checked) ts-morph analysis, a Postgres-backed job queue, and analysis results keyed by `(owner, repo, commit_sha, analyzer_version)`. Read these before proposing a different shape for ingestion, analysis, or job execution.

## Custom subagents

Two project-specific subagents are defined in `.claude/agents/` and should be invoked proactively when their trigger conditions apply:

- **`product-scope-guardian`** — use before adopting new infrastructure, integrations, frameworks, or major features. Evaluates proposals for mission alignment, MVP necessity, maintenance cost, operational risk, and simpler alternatives.
- **`analysis-integrity-reviewer`** — use after modifying analyzers, documentation generation, health checks, or AI explanations. Checks that factual claims are traceable to source, that deterministic findings are separated from AI inference/heuristics, and that uncertainty is surfaced rather than hidden.

## Git Workflow

Do not commit, or offer to commit, any changes. Those will be performed manually by the user.
