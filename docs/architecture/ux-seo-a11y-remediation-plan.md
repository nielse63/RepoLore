# UX/SEO/accessibility remediation plan

Source: an external AI audit of the live production deployment (`repo-lore-desktop-ux-seo-accessibility-audit.md`, six pages, desktop viewport, 2026-08-26), 15 findings (RL-001–RL-015). This document records an accuracy review of that audit against the actual codebase and live DOM, and the prioritized plan used to fix it.

## Audit accuracy review

Every finding was checked against source (`src/**`) and/or the live production DOM (via a headless browser against the same audited fixture repo) before being actioned. None were rejected as false positives. One root cause was corrected.

| ID | Verdict | Notes |
| --- | --- | --- |
| RL-001 | **Confirmed, root cause corrected** | Audit's hypothesis (server-rendered relative-time strings like "Analyzed 7 minutes ago") doesn't match the actual mechanism — those strings are computed once in a Server Component and baked into the RSC payload, so they can't drift between SSR and hydration. Reproduced the real React error #418 live, isolated to the **History** page only, and traced it to `HistoryContent.tsx`'s `const now = useMemo(() => new Date(), [])` — a `"use client"` component computing a fresh, non-deterministic `Date` during its hydration render, which can differ from the value used during SSR. This is the textbook cause of error #418. |
| RL-002 | **Confirmed exactly** | Live DOM check: tablist `tabindex="0"`, both `role="tab"` triggers `tabindex="-1"` including the active one. Surprising for Radix Tabs 1.1.19 (which normally manages roving tabindex itself), but directly observed in production — not a misreading. |
| RL-003 | **Confirmed exactly** | Row is a bare `<tr>` with `cursor-pointer`, no link/button/tabindex/key handler. |
| RL-004 / RL-005 | **Confirmed** | Only `src/app/layout.tsx` declares `metadata`; no route under `src/app/lore/**` (or `src/app/page.tsx`) has a `generateMetadata`. No canonical/OG/Twitter tags anywhere. |
| RL-006 | **Confirmed** | `SearchInput` (Dependencies, Data Flow) has no `<label>`/`aria-label`/`aria-labelledby`, placeholder only. |
| RL-007 | **Confirmed** | Overview: `StepList`'s step titles are hardcoded `<h4>` directly under an `<h2>` ("Start Here") section. Architecture: the project-name `<h2>` only renders when `lore.projects.length > 1`; for the single-project audited fixture it's skipped entirely, so the DOM goes H1 → H3 (`CardTitle`) → H3 ("Major Areas") → H2 ("Entry Points"). |
| RL-008 | **Confirmed** | No skip link anywhere in `LoreLayout` or root `layout.tsx`. |
| RL-009 | **Confirmed** | Verified computed styles live; 12px text carries real evidentiary content (source references, evidence/limitation prose, table headers), not just short badges. |
| RL-010 | **Confirmed; fix not kept — see below.** | ADR-0012 ("function-level call graph") item 6 documents that the page should be renamed away from "Data Flow" in its on-screen copy, but that rename was never applied. An initial pass here did apply it (`Sidebar.tsx`, `CallGraphContent.tsx`, `HistoryContent.tsx`'s kind labels), but it was reverted back to "Data Flow" during this session — treated as the current decision on naming and left alone; see "Deferred." |
| RL-011 | **Confirmed** | Both `<aside>` elements (`Sidebar`, `RightRailShell`) are unnamed. |
| RL-012 | **Confirmed** | Home page is headline + one sentence + input + button; no scope/requirements/what-happens-next copy. |
| RL-013 | **Confirmed** | `DependenciesContent.tsx`: `` `${filtered.length} dependencies` `` with no pluralization. |
| RL-014 | **Plausible, deferred** | Confirmed the card title/summary and detail heading/summary read from the same generated `entry.title`/`entry.summary` fields, which can plausibly look repetitive. Fixing this well means changing what `history/compute-history.ts` generates, not just the template — a content-generation change, not a UI fix. Deferred out of this pass; see "Deferred" below. |
| RL-015 | **Confirmed** | `SourceLink` and other `target="_blank"` links carry no visible/SR "opens in a new tab" cue. |

## Root-cause note: React error #418 (RL-001)

`HistoryContent.tsx` is a Client Component. Next.js renders it once on the server (to produce the initial HTML) and once on the client during hydration. `new Date()` is non-deterministic, so those two renders can observe different clock values; when that difference changes any rendered text (the "This week" / month-name bucket headers `bucketFor` produces, or the default timeframe range fed to `TimeframePicker`), React's hydration reconciliation fails with error #418 ("text didn't match"). This is the only client-side `new Date()`/`Math.random()`/`Date.now()` in any rendered component in the codebase — confirmed by a full-repo grep.

**Fix:** compute `now` once, server-side, in `history/page.tsx` (a Server Component that already runs per-request, no caching), and pass it down as a plain ISO string prop. The client then constructs `new Date(nowIso)` from that exact string — identical on both the SSR pass and the hydration pass, by construction, eliminating the drift rather than papering over it with `suppressHydrationWarning`.

## Prioritized implementation order

Followed the audit's own ordering, since it already reflects a sound blast-radius/severity read: reliability first, then keyboard blockers, then SEO/metadata, then document semantics, then content/polish.

1. **RL-001** — History hydration fix.
2. **RL-002, RL-003** — Dependencies keyboard blockers (tabs, row selection).
3. **RL-006, RL-008** — Search field labels, skip link.
4. **RL-004, RL-005** — Route-specific metadata, canonical/OG/Twitter.
5. **RL-007, RL-011** — Heading hierarchy, named landmarks.
6. **RL-012** — landing-page onboarding copy (RL-010's rename was reverted — see Deferred).
7. **RL-009, RL-013, RL-015** — Readability/polish.
8. **RL-014** — deferred (see below).

## Design decisions

- **Metadata**: a small shared helper (`src/lib/route-metadata.ts`) builds `{ title, description }` from a repo/page-name pair, reused by `generateMetadata` in each of the six lore routes plus a static one for `/`. Canonical + Open Graph + Twitter card fields are set via Next.js's `metadataBase` + per-route `alternates.canonical`/`openGraph`/`twitter` in the same helper, keeping each route's `generateMetadata` a one-line call rather than six copies of the same object shape. Repository pages that show data acquired at analysis time (not evergreen marketing content) are marked `robots: { index: false, follow: true }` — the audit correctly flagged that indexability intent was never made explicit; per-repo Lore pages are not intended to be indexed today, so this makes that explicit rather than leaving it ambiguous, while still allowing crawlers to follow links (e.g. to the home page).
- **Tabs (RL-002)**: rather than trust Radix's internal roving-tabindex state (observed wrong in production for reasons not fully diagnosable from outside Radix's internals), `DependenciesContent` switches the `Tabs` to controlled (`value`/`onValueChange`) and each `TabsTrigger` receives an explicit `tabIndex={value === tabValue ? 0 : -1}` from the call site, which Radix's underlying `Primitive.button` forwards to the DOM. This makes correct roving-tabindex behavior a property of our own code, not a library internal we're hoping stays correct.
- **Row selection (RL-003)**: first cell gets a real `<button>` with an accessible name (`View {name} dependency details`) absolutely positioned to cover the full row (a standard "clickable table row" pattern — the interactive element is real and singular, not a `tabIndex` hack on the `<tr>`), so pointer and keyboard produce the identical `setSelectedId` call.
- **Skip link (RL-008)**: added once, in `LoreLayout` (the shared shell for every repository view), as the first focusable element, targeting a new `id="lore-main-content"` on `LorePageFrame`'s `<main>`.
- **12px→14px (RL-009)**: scoped to the specific categories the audit named as carrying "meaningful metadata" — table headers (`Th`), source references (`SourceLink`), the repo-identity status/branch/timestamp row, evidence/limitation prose, and history entry metadata rows. Left untouched: `Badge` (audit's own carve-out for "short, nonessential" labels), compact diagram node labels in `CallGraphDiagram`/`AreaDependencyDiagram` (the latter is currently dead/unwired code, not rendered anywhere), and calendar-picker chrome.
- **RL-010 not kept**: the "Data Flow" → "Call Graph" copy rename was applied and then reverted during this session, keeping "Data Flow" as the on-screen name. ADR-0012 item 6's rationale for the rename stands unresolved — see "Deferred."
- **Mockup conformance**: checked the 12px→14px sweep, the `ExternalLink` icon added to every `SourceLink`, and `SourceLink`'s inline→`inline-flex` switch against `dependencies.png` and `repository-overview.png`, and against a real render (`nielse63/RepoLore`, both routes) in a browser. `docs/designs/` predates this pass's accessibility audit and doesn't depict either affordance, but neither changes layout or information hierarchy: text size moved one Tailwind step within the same table/prose positions the mockups show, and the icon/`inline-flex` change adds a small trailing glyph without altering how `SourceLink` wraps inside prose or list items in the rendered pages. Treated as an audit-driven refinement within the existing mockup layout, not a deviation from it.

## Testing strategy and a disclosed gap

Per `CLAUDE.md`, every change should leave the test suite reflecting the new behavior. This codebase's suites are narrower than the audited surface:

- **Jest** (`src/**/__tests__/*.spec.ts`) runs in a Node environment with no React Testing Library — it covers pure logic (analyzers, formatters), not component rendering/DOM/accessibility semantics. All 453 existing specs still pass unchanged; none of this pass's changes were pure-function logic distinct enough to need a new spec file (the pluralization fix is a one-line inline ternary, matching the existing inline style already used for singular/plural counts elsewhere in the same files, e.g. `usageEvidence(dep).length === 1 ? "reference" : "references"`).
- **Playwright** (`e2e/*.spec.ts`) currently covers only routes that need no database (`/`, 404). Extended `e2e/home.spec.ts` with two new tests — the onboarding copy near the form (RL-012) and canonical/Open Graph/Twitter metadata (RL-005) — both passing. There is still no seeded-database fixture for `/lore/{owner}/{repo}/**`, so Dependencies keyboard nav, tab semantics, heading order, and landmark names on repository views aren't covered by an automated regression test.

Building that DB-seeded Playwright fixture (the audit's own "Suggested regression coverage" section effectively asks for this) is a real, separate infrastructure investment, not a one-line addition. **This plan does not build that infrastructure.** Instead, every DB-backed lore-page fix was verified directly against a locally-run dev server backed by the real local Postgres (`docker compose up db`), using two already-analyzed repositories (`nielse63/repo-lore-ts-library-fixture` — re-analyzed locally via `npm run analyze-repo` to match the exact repo the audit used — and `stemmlerjs/simple-typescript-starter`), fetching the rendered HTML and confirming the exact DOM properties the audit checked:

- Tabs: SSR HTML shows `role="tablist"` with `tabindex="-1"` and the active `role="tab"` with `tabindex="0"`, inactive with `-1"` (RL-002, fixed).
- Dependency row: a real `<button aria-label="View {name} dependency details">` covering the row (RL-003, fixed).
- `<title>`, `<link rel="canonical">`, `og:title`, `robots: noindex,follow` unique per route (RL-004/RL-005, fixed).
- `<label>` before each search input (RL-006, fixed).
- Heading sequence H1→H2→H3 with no skipped level on Overview and Architecture (RL-007, fixed).
- "Skip to main content" link present as the first link in the lore shell (RL-008, fixed).
- `text-sm` (not `text-xs`) on table headers, source links, and evidence prose (RL-009, fixed).
- Both `<aside>` elements uniquely named via `aria-label`/`aria-labelledby` (RL-011, fixed).
- "1 dependency" / "N dependencies" pluralized correctly (RL-013, fixed).
- "(opens in a new tab)" present on external source links (RL-015, fixed).
- Full `npm run test:unit` (453 tests) and `npx eslint src` pass with no new failures or warnings; `npx tsc --noEmit` is clean.

This is real verification against real server-rendered output, not a guess — but it is not a durable regression test that fails automatically if one of these regresses later. That gap is called out explicitly, per `CLAUDE.md`'s instruction to state rather than silently skip: **the lore-page fixes in this pass have one-time manual/scripted verification, not automated regression coverage.** A follow-up session should build the seeded-DB Playwright fixture and add the axe-core + keyboard tests the audit recommends.

## Deferred

- **`/lore/{owner}/{repo}/search`** — a preview scaffold (`"use client"`, hardcoded fixture data via `PreviewBanner`'s "Search isn't implemented yet for this repository", not linked from `Sidebar`'s `NAV_ITEMS`) that this pass's audit review missed entirely. Its `SearchInput` (RL-006) and `Tabs` (RL-002) instances got the same fixes as `DependenciesContent`'s, since those were cheap and identical in shape. Left unfixed: it still has no `generateMetadata`/`noindex`, so it's the one repository-scoped route (besides `not-found.tsx`) that inherits the root layout's `alternates: { canonical: "/" }` and is indexable by default. Fixing that properly means restructuring the file into a server page (`generateMetadata`) wrapping a client content component, matching the five real lore routes — real work on a route with no real content yet. Flagged rather than fixed; revisit once the route either gets real search results or gets removed.
- **RL-010** (rename "Data Flow" → "Call Graph") — applied, then reverted per explicit product-owner direction during this session; "Data Flow" stays the on-screen name (and now also the name of the two page-specific source files, `DataFlowContent.tsx`/`DataFlowDiagram.tsx`, renamed to match — see the 2026-08-26 addendum to ADR-0012). This leaves ADR-0012 item 6 as a recorded decision the product has now explicitly reversed rather than never gotten to — the addendum records that, so the ADR and the shipped UI no longer silently disagree.
- **RL-014** (History card/detail copy repetition) — needs a content-generation change in `src/history/compute-history.ts`/`src/history/classify.ts` (what `summary` vs. `title` actually says), not a template fix. Flagged for its own pass so the wording change gets the same evidentiary-accuracy scrutiny (`analysis-integrity-reviewer`) as the rest of this codebase's generated claims, rather than being rushed alongside two dozen unrelated UI fixes.
- Building the DB-seeded Playwright fixture + axe-core CI gate the audit recommends (see Testing strategy above).
