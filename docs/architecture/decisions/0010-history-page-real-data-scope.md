# ADR-0010: The History page is a deliberate, scoped exception to the "no commit-history analysis" non-goal

## Status

Accepted

## Context

`/lore/{owner}/{repo}/history` (`src/app/lore/[owner]/[repo]/history/page.tsx`) previously rendered entirely hardcoded example content (`HISTORY_ENTRIES` in `src/lib/fixtures/payments-service.ts`), matching `docs/designs/history.png`'s mockup: a timeline of narrative entries ("Payment retries moved to the background worker") each with a title, summary, "what changed" bullets, a "why Repo Lore noticed" explanation, affected systems, and (in the right rail) a before/after architecture diagram.

Both `docs/product/mvp.md` and `docs/product/non-goals.md` explicitly list **"commit and pull-request history analysis"** among the MVP's excluded capabilities. A `product-scope-guardian` review, run before this ADR, evaluated whether to build a real version of this page at all and recommended against it — History isn't part of the Minimum Value Contract or Core User Journey, no commit-listing/diff-fetching GitHub API integration exists anywhere in the codebase, and even a stripped-down raw commit log (no narrative synthesis) failed the MVP-necessity bar. The review's recommendation was to leave History fixture-backed and resume deploy (implementation plan session 17).

**The product owner explicitly overruled that recommendation** and requested the real-data implementation proceed regardless, with full mockup fidelity as the target. This ADR records that decision and the scope discipline applied to it, so the exception is legible later rather than silently contradicting `non-goals.md`.

## Decision

1. **This is a deliberate, one-page exception — `non-goals.md` is not amended.** The general MVP exclusion still holds for the rest of the product; this ADR documents why History specifically was built anyway, not a reversal of the underlying policy. A reviewing agent or future maintainer should not read `non-goals.md`'s continued exclusion as inconsistent with this page existing — this ADR is the record of the override.
2. **New GitHub commit-list and commit-diff API integration** (`src/github/commits.ts`): `listCommitsSince` (paginated commit listing) and `fetchCommitDetail` (per-commit changed files with patch text), bounded by a fixed `HISTORY_LOOKBACK_DAYS = 90` window and a hard `MAX_COMMITS_PER_COMPUTE = 200` cap — truncation is surfaced in the UI, never silent.
3. **No AI/LLM narrative generation.** All entry titles, summaries, and "why Repo Lore noticed" text are built from fixed templates over structured facts (`src/history/classify.ts`'s `describeEntry`), not a model call — consistent with `non-goals.md`'s separate "AI-generated explanations or chat" exclusion, which this ADR does not touch.
4. **Classification is patch-text heuristic, not real parsing**, and is labeled accordingly: every fact `classifyCommitFiles` produces carries `certainty: "inferred"` or `"unknown"` (never `"detected"`), and lives in a new `src/history/model.ts` kept deliberately separate from `src/lore/model.ts` — the core `Lore` model represents ts-morph/tree-sitter deterministic syntactic analysis, and this feature must not be presented with that same rigor. Three change kinds are detected: dependency-manifest changes (parsed from patch diff lines), cross-`StructuralArea` relative-import changes (regex-detected, resolved against the already-computed `StructuralArea` locations — no new analyzer capability), and data-layer path changes (naming-convention matching, e.g. `models/`, `migrations/`, `schema`). Under-detection (a missed multi-line or aliased import) is the accepted failure mode; a false-positive relationship claim is not.
5. **No before/after diagram.** The mockup's right-rail box diagram would require either re-running the structural analyzer at two historical commits (rejected as a data-source option — see "Alternatives considered") or deriving a graph from the same patch-regex heuristic, which raises the overclaiming risk ADR-0008 already rejected once for the Architecture page. Deferred as separately-scoped future work, following the ADR-0008 → ADR-0009 precedent (ship the plain version first, add a narrowly-scoped diagram later if still wanted).
6. **No "View in Evidence Library" link** (mockup) — no such page exists anywhere in the app yet.
7. **No interactive date-range picker** (mockup) — replaced with a static label reflecting the actual fixed lookback window (`"Last {HISTORY_LOOKBACK_DAYS} days"`), consistent with `non-goals.md`'s general bias against new interactive controls without demonstrated need.
8. **Cached, not automatic.** Computed entries are persisted per repo (`history_entries`, one row per repo, upserted) and only recomputed via a manual "Refresh history" action (`refreshHistory` in `src/app/actions.ts`, rate-limited the same way as `reanalyzeRepository`) — never on a schedule, matching the rest of the app's no-scheduled-refresh rule even though History itself is an override of a different non-goal.

## Rationale

Given the product owner's decision to proceed, the remaining question was how to build it without also violating the _other_ non-goals it's adjacent to (AI-generated explanations, architectural diffs/interactive graphs, complete framework-specific interpretation). Each guardrail above closes one of those: deterministic templates instead of AI narrative; `inferred`/`unknown` certainty instead of presenting regex-matched patch text as `detected` fact; no diagram instead of a graph that can't be honestly derived from the available signal; a static lookback label instead of new interactive-control surface area.

## Alternatives considered

**Reuse persisted `analysis_runs` snapshots** (diff two already-persisted `Lore` models between manual re-analyses, per `docs/architecture/implementation-plan.md`'s original framing of the options) — rejected per the product owner's explicit choice of live GitHub commit data over this option. It remains the lower-cost, more deterministic alternative if the GitHub API integration's maintenance cost (rate limits, pagination, patch-format edge cases) proves too high in practice.

**Re-run the structural analyzer across historical commits** to get real before/after `Lore` snapshots for the diagram — rejected as prohibitively expensive (a full tarball fetch + ts-morph/tree-sitter pass per historical sample point) for a solo-maintainer, synchronous-analysis architecture (ADR-0004), and explicitly ruled out when the data-source decision was made.

## Consequences

- New application code: `src/github/commits.ts`, `src/history/` (`model.ts`, `classify.ts`, `compute-history.ts`, `history-rate-limit.ts`), `src/db/history-entries.ts` + migration `0004_history_entries.sql`, `src/components/RefreshHistoryButton.tsx`, `src/components/lore-shell/HistoryContent.tsx`, and the rewritten `history/page.tsx`.
- `src/lib/fixtures/payments-service.ts`'s `HISTORY_ENTRIES` export becomes unused by the real History page (left in place, matching ADR-0008's precedent for `ARCHITECTURE_LAYERS`).
- The rejected pieces (before/after diagram, Evidence Library link, interactive date range, `analysis_runs`-diff or re-analyzed-history data sources) remain available as later, independently-scoped work, each needing its own review before starting.
- Because this page now makes live GitHub API calls proportional to a repository's recent commit volume (up to 201 requests per compute: one commit-list page per ~100 commits, plus one per-commit detail fetch), it is a materially heavier consumer of the shared token's rate limit than any other feature in the app — worth monitoring once deployed.
