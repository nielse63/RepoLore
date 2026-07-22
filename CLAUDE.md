# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is pre-code: it currently contains only a README, `.gitignore`, and two Claude Code subagent definitions under `.claude/agents/`. There is no package manifest, build system, linter, or test suite yet — do not assume any exist. Once a toolchain is added, this file should be updated with the actual build/lint/test commands.

## Product

RepoLore's working product name (per the subagents below) is **RepoLore**: it builds an automatically refreshed, readable "atlas" of a repository at a stable URL, helping an engineer build an accurate mental model of an unfamiliar codebase within one day, without relying on tribal knowledge.

Constraints that should shape any proposed feature or dependency (see `product-scope-guardian` below for the full checklist):

- Maintained by one engineer as a side project (~5–8 hrs/week, never more than 10).
- Initial customer: startups / small-to-medium engineering orgs.
- Initial supported ecosystem: TypeScript and React.
- Prefer managed services, standard libraries, deterministic analysis, and reversible decisions.
- Reject speculative scalability, enterprise requirements, and premature customization.
- AI explains evidence-backed analysis; it does not replace deterministic code analysis.

## Custom subagents

Two project-specific subagents are defined in `.claude/agents/` and should be invoked proactively when their trigger conditions apply:

- **`product-scope-guardian`** — use before adopting new infrastructure, integrations, frameworks, or major features. Evaluates proposals for mission alignment, MVP necessity, maintenance cost, operational risk, and simpler alternatives.
- **`analysis-integrity-reviewer`** — use after modifying analyzers, documentation generation, health checks, or AI explanations. Checks that factual claims are traceable to source, that deterministic findings are separated from AI inference/heuristics, and that uncertainty is surfaced rather than hidden.

## Git Workflow

Do not commit, or offer to commit, any changes. Those will be performed manually by the user.
