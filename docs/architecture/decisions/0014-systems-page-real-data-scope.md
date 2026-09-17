# ADR-0014: Real Systems page — a renamed, re-presented view of existing Major Areas, no new analyzer capability

## Status

Accepted

## Context

`/lore/{owner}/{repo}/systems` (`systems/[[...slug]]/page.tsx`) currently renders `notFound()` unconditionally; the Systems sidebar link is commented out in `Sidebar.tsx`. A fully mockup-faithful UI already exists at `_systems/` (excluded from routing by its `_` prefix) bound entirely to hardcoded fixture data (`SYSTEMS` in `src/lib/fixtures/payments-service.ts`), matching `docs/designs/systems.png` and `docs/designs/systems-subview.png`: a list of "systems" (Payment Service, Auth Service, Worker, Notification Service, PostgreSQL, Redis) typed Core/Supporting/Data, each with a subview showing responsibilities, ownership, a relationship diagram, entry points, and evidence.

The product owner asked to build this for real, initially citing archify (github.com/tt-a1i/archify) as a model for AI-driven codebase-to-diagram generation, extending to Overview and Architecture as a follow-on. Research and a `product-scope-guardian` review (both preceding this ADR) established:

1. **Archify is not a code analyzer.** Its own documentation describes an AI coding agent (Claude, Cursor, etc.) authoring a typed JSON diagram spec interactively in a chat session; Archify deterministically validates and renders that spec into a standalone HTML artifact. There is no unattended, callable analysis backend to adopt, and nothing about it fits a synchronous, single-Next.js-deployable production pipeline on Render.
2. **AI-driven diagram generation would conflict with `docs/product/mission.md`** ("AI is secondary... it must not act as the primary repository-analysis engine") and with `docs/product/non-goals.md`'s current, unqualified exclusion of "AI-generated explanations or chat." No LLM/AI SDK dependency exists anywhere in this codebase today; introducing one — even for narration only — would be a materially larger, separately-scoped decision than this page.
3. **The mockup's Core/Supporting/Data typing and its Postgres/Redis nodes assume infrastructure/service-boundary detection**, which ADR-0008 already evaluated and rejected outright ("no natural stopping point").
4. **The exact component this page needs already exists but is dead code.** `AreaDependencyDiagram.tsx` (ADR-0009) is only referenced from `ArchitectureContent.tsx`'s "Component Connections" section, and that entire section — diagram and table both — has been wrapped in a JSX comment since commit `a9808aa` ("latest data-flow page changes", 2026-08-25), with no recorded reason. It was never wired into `OverviewContent.tsx` at all, contradicting ADR-0009's own "Consequences" section, which states it's embedded on both pages.

The product owner made the following decisions in response, which this ADR records and scopes:

- No AI, no new LLM dependency, no diagram-authoring model. Fully deterministic, reusing existing `Lore`-model data and existing derivation/render code.
- "System" = the existing `StructuralArea` (Major Area) concept, renamed and re-presented. No new extraction, no new analyzer capability.
- No infrastructure/data-store nodes. Systems are code-owned areas only, staying inside ADR-0008's existing boundary.
- Systems ships first, end-to-end, as its own scoped unit. Enhancing Overview/Architecture with anything beyond restoring the diagram (item 5 below) — in particular, ever surfacing the unexposed, undocumented Program Behavior Graph (`src/analysis/shared/behavior-graph.ts`, computed by extraction but rendered nowhere, no ADR of its own) as a "workflows" view — is explicitly deferred to its own future proposal and review, not part of this ADR.
- The dead `AreaDependencyDiagram` embed (finding 4) is fixed as part of this ADR, since Systems depends on it being a real, live component rather than a reuse of code nobody has verified still works end-to-end.

## Decision

1. **Routing.** `systems/[[...slug]]/page.tsx` becomes a real optional-catch-all: no slug segment renders the list view; one segment renders the subview for that area's slug; an unknown slug or more than one segment renders `notFound()`. `_systems/` (both its list and subview pages, including `change-impact/page.tsx`, which has no mockup-backed equivalent and is dropped rather than migrated) is deleted once the real pages ship. The Systems entry in `Sidebar.tsx`'s `NAV_ITEMS` is un-commented.

2. **New pure module `src/lore/system-classification.ts`.** Buckets each `StructuralArea` into the same two categories `AreaDependencyDiagram.tsx` already uses internally, reusing its exact wording rather than inventing new labels:
   - `"Tests / test support"` — `responsibility` is `"Tests"` or `"Test fixtures/support data"`.
   - `"Build/tooling configuration"` — `responsibility` is `"Build/tooling configuration"`.
   - `"Implementation area"` — everything else (the ordinary case, including areas with no special `responsibility` and framework-detected ones like `"Presentational React components"`).

   This is a straight reuse of `derive-views.ts`'s existing `NON_PRIMARY_AREA_RESPONSIBILITIES` set and matches `AreaDependencyDiagram.tsx`'s own `RESPONSIBILITY_STYLES`/`legendLabel` mapping verbatim. It deliberately does **not** use "Core," "Primary," or any label implying business criticality or importance — the module's doc comment states explicitly that this is a bucket over an existing `responsibility` string, not a criticality, health, or centrality judgment, since nothing computed here measures usage, importance, or dependency centrality. This replaces the mockup's invented three-way Core/Supporting/Data split (which implied an unevidenced "Data" category) with a wording-safe two-way-in-effect grouping that adds no new claim beyond what `derive-views.ts` and `AreaDependencyDiagram.tsx` already assert today.

3. **List page** (`src/components/lore-shell/SystemsContent.tsx`, replacing the fixture-bound stub): one row per `StructuralArea` — name, `rationale`/`responsibility` as description, the label from (2) as a badge, owned paths (`area.location`/`importantLocations`), relationship count (`directDependencyIds.length + directDependentIds.length`, the same figure Architecture already computes), evidence count (`area.evidence.length`). Search-by-name and filter-by-label are client-side over already-fetched data, mirroring `DependenciesContent.tsx`'s existing pattern. The mockup's per-row "Technology" column is dropped — `Project.languages`/`frameworks` exist at the project level, not per-area, and inventing per-area technology attribution is new analyzer work this ADR doesn't do. The right rail reuses `AreaDependencyDiagram` unmodified, given the full `majorAreas`/`areaRelationships` for the repository (falling back to a "too many areas to diagram" note when `deriveAreaDiagramLayout` returns `null`, per its existing `MAX_DIAGRAM_AREAS` cap).

4. **Subview page** (new `src/components/lore-shell/SystemDetailContent.tsx`, at `/lore/{owner}/{repo}/systems/{areaSlug}`): a single-tab Overview view (the mockup's separate Responsibilities/Relationships tabs are collapsed into "View all" expansions within Overview, matching the "View all flows"/"View all references" pattern already used elsewhere in the app, not separate routes) showing:
   - **Responsibilities**: the area's `responsibility` (if any) and `rationale`, as existing data — not a multi-item list, since the model has no per-area list of responsibility statements to draw from.
   - **Owns**: `location` and `importantLocations`.
   - **Relationships**: `AreaDependencyDiagram` given only this area plus the areas reachable via its `directDependencyIds`/`directDependentIds`, and the relationship edges between them — a filter over already-computed data, not a new layout mode.
   - **Key entry points**: `EntryPoint`s whose id is in this area's `entryPointIds`.
   - **Evidence**: this area's `evidence` array, rendered as citations (reusing `SourceLink`/evidence-list patterns already used on Architecture).

   The mockup's "Appears in these flows" section and the Evidence panel's "Graph" sub-tab are dropped, not deferred with placeholder UI: the former would require exposing the Program Behavior Graph, which has no ADR of its own and is out of scope here (see Context); the latter would duplicate the Overview section's relationship diagram for no new information.

5. **Slug helper.** A new small function (co-located with `system-classification.ts` or its own `src/lore/system-slug.ts`) derives a kebab-case slug from each `StructuralArea.name`, with a numeric-suffix fallback for collisions within one analysis run (areas aren't guaranteed unique names across multiple projects in a mixed-language repository). Slugs are stable only within a single analysis run's area list; a subsequent re-analysis that adds, removes, or renames areas can shift which area a given slug (and therefore a previously bookmarked or shared `/systems/{slug}` URL) resolves to. This is not a new problem this feature introduces — area identity across re-analyses is already this loose — but it's the first time a shareable URL is built directly on top of that instability, so it's disclosed here rather than silently inherited.

6. **Restore `AreaDependencyDiagram` as a live component.** `ArchitectureContent.tsx`'s "Component Connections" section (diagram and table) is un-commented, restoring it to the state ADR-0009 originally shipped. `OverviewContent.tsx` is wired to embed the diagram in place of any remaining raw file-level relationship presentation, per ADR-0009's Decision item 6, which specified this but was never implemented. This is a restoration of already-decided, already-built ADR-0009 scope, not new capability — Systems becomes the diagram's third embed surface, which this ADR names explicitly as a small extension of ADR-0009's embed list, per that ADR's own requirement that future extensions get their own review.

7. **No `non-goals.md` amendment.** Nothing here extends interactivity, lowers the diagram below area-level granularity, or adds a new inferred claim beyond what ADR-0008/0009 already cover — this ADR operates entirely inside their existing boundaries.

## Rationale

**Why a two-way label instead of the mockup's Core/Supporting/Data.** A `product-scope-guardian` review flagged that a "Core" vs. "Supporting" badge, sitting next to each other visually, reads as a criticality/importance judgment even when the underlying computation is narrower ("this area's `responsibility` string isn't Tests/tooling"). `non-goals.md`'s rejection of "generalized health findings" exists precisely to prevent presentation implying a value judgment the analysis can't back up. Reusing `AreaDependencyDiagram.tsx`'s own already-established, deliberately descriptive vocabulary avoids inventing a new claim and keeps the two pages visually and semantically consistent.

**Why the Postgres/Redis nodes are dropped rather than approximated.** `ExternalDependency` (ADR-0011) records declared package dependencies, not runtime infrastructure topology — treating "depends on the `pg` package" as "this repository has a PostgreSQL system" would be exactly the inferred-usage claim ADR-0008 already rejected ("labeling Redis as a cache/queue... an inferred usage claim the analyzer can't justify"). No version of this ADR's proposal reopens that.

**Why the diagram restoration belongs in this ADR rather than being left as a separate, unrelated bug.** Building Systems' list-view right rail and subview relationships section on a component whose only real call site is currently disabled, unverified in the live app, would mean shipping a second, equally-unverified consumer of it. Fixing the one real regression first is cheaper and lower-risk than debugging two call sites later.

**Why "Appears in these flows" is dropped, not stubbed.** Building even a placeholder for it would invite wiring in the Program Behavior Graph piecemeal, without the ADR and scope review that capability deserves on its own — the same shortcut ADR-0009 §7 already warned against for file-level relationships.

## Alternatives considered

**AI-generated diagrams/layout (the original archify-inspired framing).** Rejected — archify itself doesn't do this (see Context, finding 1); a from-scratch equivalent would require a new LLM dependency, cost, latency, and failure-mode surface, and would make AI a primary structuring step, contradicting `mission.md` directly.

**A new "system" concept above Major Areas** (multiple areas rolling up into one system). Rejected for this round — no analyzer signal currently exists for that grouping (package/workspace boundaries are already Major Areas' own first preference per `derive-views.ts`), and it would be new modeling work disproportionate to what the mockup actually needs.

**Representing infrastructure via a narrow `ExternalDependency`-derived "Data" category.** Considered and rejected by the product owner in favor of dropping infra nodes entirely — the simpler, more conservative option, and the one that requires no new scope exception at all.

**Bundling Overview/Architecture "workflow" enhancements (via the Program Behavior Graph) into this same ADR.** Rejected — that capability has no ADR of its own today, and folding its first real UI exposure into a page primarily about Major Areas would understate the review it deserves. Left as an explicit, separately-scoped follow-on.

## Consequences

- New application code: `src/lore/system-classification.ts` (+ spec), a slug helper (+ spec), `src/components/lore-shell/SystemsContent.tsx`, `src/components/lore-shell/SystemDetailContent.tsx`, the rewritten `systems/[[...slug]]/page.tsx`.
- Deleted: `src/app/lore/[owner]/[repo]/_systems/` (list, subview, and `change-impact` pages).
- Changed: `Sidebar.tsx` (Systems link restored), `ArchitectureContent.tsx` (Component Connections section restored, no logic change), `OverviewContent.tsx` (diagram embed added per ADR-0009's original, unimplemented decision).
- `src/lib/fixtures/payments-service.ts`'s `SYSTEMS`/`SystemSummary` export becomes unused by the real page (left in place, matching ADR-0008/0009/0010/0011/0012 precedent for superseded fixture content).
- Subview URLs (`/systems/{slug}`) are stable only within one analysis run's area set; re-analysis can shift slug-to-area assignment. Disclosed, not fixed, in this ADR — a stronger guarantee would require persistent area identity across runs, which doesn't exist anywhere in the model today.
- `AreaDependencyDiagram` now has three live embed surfaces (Architecture, Overview, Systems) instead of zero; any future change to that component affects all three.
- Deferred, explicitly out of scope here: any "workflows" view backed by the Program Behavior Graph, an AI-narration layer, and any further Overview/Architecture enhancement beyond the diagram restoration in Decision item 6 — each needs its own future ADR and `product-scope-guardian` review, the same discipline this ADR itself followed.
