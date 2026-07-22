# MVP

## Hypothesis

A continuously updated, evidence-backed repository lore can help an engineer form a useful mental model of an unfamiliar TypeScript or React codebase much faster than reading the repository manually or relying on tribal knowledge.

The first "wow" moment: *I pasted a GitHub repository URL, waited for analysis, and received a clear map that showed me where to start, what mattered, and how the application fit together.*

## Initial customer

Startups and small-to-medium software companies. Not optimized for large enterprises — see `non-goals.md`.

## Initial supported ecosystem

1. TypeScript applications and libraries
2. React applications written in TypeScript

React support adds framework-aware understanding on top of the shared TypeScript analysis engine — there is one analyzer, not two unrelated ones.

## Product experience

A user supplies a public GitHub repository URL. Repo Lore creates a stable, readable URL for that repository's generated lore: `https://repolore.dev/lore/{owner}/{repository}`. The lore regenerates automatically on a reasonable schedule by checking the default branch — no webhook, GitHub Action, config file, script, or CI integration required from the user. Pasting a URL is enough.

## First vertical slice

See `docs/architecture/decisions/` for the technical decisions and `docs/architecture/implementation-plan.md` for the acceptance criteria and session breakdown. In outline, the first slice:

1. Accepts and validates a public GitHub repository URL.
2. Resolves the default branch and a specific commit SHA, and fetches source at that commit.
3. Detects whether the repo is a supported TS or React project and reads relevant configuration.
4. Discovers TypeScript source files, excluding generated/vendored/build/dependency directories.
5. Extracts a deterministic project model: project type, source files, imports/exports, internal dependency edges, probable entry points, and confidently-detected React components.
6. Derives a small set of views: repository summary, "start here" files/concepts, module/package dependency map, important entry points, and high-confidence health findings.
7. Stores the result, keyed by repo + commit + analyzer version, and renders it at the stable lore URL with the analyzed commit SHA and timestamp.
8. Links important findings back to source evidence, handles unsupported/partially-supported repos honestly, and offers a manual re-analysis action.
9. Leaves a clean seam for scheduled refresh later, without a complicated scheduling platform now.

The eventual full lore (system overview, architectural map, package/module boundaries, React routes/pages, data/execution flows, external integrations, repository health, uncertainty, evidence links, a "start here" learning path) is the long-term target — the first slice deliberately implements only a useful subset of it.

## What the MVP is not optimizing for

A simple list or table is acceptable before a sophisticated graph visualization exists. Accurate and useful beats visually impressive.
