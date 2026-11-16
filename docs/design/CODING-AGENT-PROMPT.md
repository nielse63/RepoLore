# Implement the Repo Lore visual redesign

You are working in the existing Repo Lore application. Use the attached `repo-lore-prototype.html` and `HANDOFF.md` as the design and interaction reference. The `src/` files separate styling, page rendering, and sample data to make the reference easy to inspect.

First read the repository's `AGENTS.md` and existing architecture. Inspect the actual routes, components, data models, graph implementation, analysis states, source evidence, and tests before making changes. Work within the existing stack and design primitives. Preserve routes, deep links, analysis behavior, and supported capabilities.

The goal is to make the application easier to understand, acquire users by showing the result sooner, and retain users by making code relationships and changes useful to revisit. Preserve the warm paper background, editorial headings, restrained teal, and evidence-first identity.

## Deliver the complete existing page set

1. Homepage: concrete value proposition, repository input, interactive result preview, visible example path.
2. Explore: examples selected for how well they demonstrate understanding, with focused entry paths.
3. Manifesto: readable editorial page consistent with the rest of the product.
4. Overview: a concise orientation, readable relationship map, and three evidence-backed starting points.
5. Architecture: map before inventory, readable labels, selection, immediate-neighbor focus, expansion, and contextual evidence.
6. Systems: responsibility-oriented list with honest grouping confidence.
7. System detail: purpose, member areas, relationships, starting points, and evidence.
8. Dependencies: clear package role, scope, declaration, and source-reference inspection, with appropriate search/filter/sort.
9. Data Flow: entry-point exploration, source call relationships, useful function inspection, and clear analytical limits.
10. History: concise distinct changes, affected areas, source evidence, and explicit uncertainty about missing rationale.

Use the real current route families described in HANDOFF.md. Hash routes and `#/design` are prototype conveniences only.

## Shared behavior

- Keep analysis metadata compact and open the contextual evidence inspector when a user selects something meaningful.
- Keep the analyzed commit and freshness truthfully visible.
- Reuse the existing graph library, source links, copy-badge behavior, and analysis pipeline.
- Make mobile a reading experience: navigation menu, reflowed content, wrapping paths, and a focused evidence sheet.
- Implement useful loading, empty, error, stale, partial, search-empty, and not-found states using actual backend status and recovery actions.
- Maintain keyboard support, focus indicators, dialog focus containment, Escape dismissal, focus restoration, reduced motion, and touch targets.

## Evidence is a hard constraint

The prototype's Trailhead repository, commits, package versions, role names, source excerpts, and paths are illustrative fixtures. They must never appear as real analysis of a user's repository. Do not copy them into production data or ship the fake analysis progress flow.

Detected imports, source calls, configuration facts, inferred groupings, and unknown runtime behavior are different things. Preserve that distinction. An import is not a call. A static call path is not a recorded execution. A source diff does not prove author intent. Do not use AI to fill a gap in evidence.

Where the reference assumes richer data than the application currently supplies, implement the best truthful presentation of the existing data. Keep new inference rules or backend capabilities out of the visual redesign unless the user separately authorizes them. Record the limitation in your final handoff instead of fabricating a finding. If a numeric importance score is retained, explain its existing scale and signals; do not invent a new ranking algorithm.

## Implementation approach

1. Identify reusable primitives: application shell, page heading/status, relationship map, starting-point row, evidence inspector, source view, filters/table, change list, and state presentation.
2. Implement the shared shell and Overview, then extend the same primitives to all repository sections.
3. Update public pages to match the promise and the delivered result.
4. Complete responsive and state behavior using existing backend capabilities.
5. Run the repository's required checks and targeted tests for routing, selection, filters, evidence provenance, analysis actions, and accessibility. Check real desktop and mobile rendering with open panels and long paths.

Keep implementation maintainable by one developer. Do not introduce a new framework, graph engine, global state system, account flow, billing system, runtime tracing service, or AI pipeline just to reproduce this reference.

Complete the implementation rather than stopping at a plan. In your final report, describe what changed, what was verified, and any UI capability that was simplified because source evidence or backend support was absent.
