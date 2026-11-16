# Repo Lore — focused assignments for coding agents

These are separate assignments, not a command to build everything. Give an agent the shared context below and one assignment at a time. Start with the evaluation baseline, then use the UI assignments alongside the visual redesign.

The source references below were checked against `dev` at `79fba334b9811c79b5c888eba10881b21490dc49`. Reinspect the current checkout before changing anything: file contents and capabilities may have moved forward.

## Shared context to prepend

You are working on Repo Lore, a living, evidence-backed mental model of a repository. Its first measurable outcome is that an unfamiliar experienced engineer can form a correct orientation and choose a justified starting point within roughly 15 minutes. The longer-term ambition is confident understanding by the next day.

Read the current `AGENTS.md`, applicable `CLAUDE.md` guidance, `docs/product/mission.md`, `docs/product/non-goals.md`, and `docs/MODEL_OUTPUT.md`. Read the installed Next.js guides required by this repository before writing application code. Respect the repository's review, testing, documentation, and Git workflow. Do not automatically commit, publish, or deploy.

Preserve the existing Next.js application, Tailwind tokens, Radix primitives, React Flow/Dagre, Postgres persistence, source acquisition limits, supported languages, and stable public routes. The current product supports TypeScript, JavaScript, and Python; capability differences between them must remain explicit.

Detected, Inferred, Unknown, and Unsupported have different meanings. Source imports are not calls. Static calls do not prove execution order. A missing edge does not prove absence of a relationship. Role labels need evidence. Function importance is relative to one analysis, not a quality rating. Source evidence must identify the analyzed commit.

Use the real persisted analysis model. The Trailhead HTML prototype contains illustrative data only. Reuse the existing model and derivations wherever possible. If a proposed interaction requires evidence the model lacks, implement a truthful smaller version and identify the missing capability separately.

Keep the work appropriate for one maintainer developing approximately 5–8 focused hours weekly. Treat each assignment as a small, reviewable change. Follow existing test requirements; update stale assertions rather than preserving old behavior accidentally. Finish with what changed, the user benefit, actual verification results, and remaining limitations.

## Suggested sequence

| Assignment | Scope | When to use it |
| --- | --- | --- |
| 1. Can Repo Lore explain itself? | MVP evaluation | Establish a baseline before expanding the interface. |
| 2. Misleading repositories | MVP regression protection | Protect correctness while presentation gets more persuasive. |
| 3. Explain this arrow | MVP redesign | Make a relationship useful at the moment of selection. |
| 4. Share the exact starting point | Soon | After the selection and inspector behavior settles. |
| 5. Read before editing | Soon experiment | When users can find a function but still struggle to choose their next step. |
| 6. Put limits where they matter | MVP redesign | Alongside evidence inspectors and state handling. |
| 7. A real example tour | Soon acquisition experiment | Once Overview and the shared workspace are ready. |
| 8. A delivery contract | MVP workflow | Append to every implementation assignment. |

Do not run overlapping UI assignments simultaneously against the same files. Ship a usable slice, inspect its result, then choose the next assignment.

---

## Assignment 1 — Can Repo Lore explain itself?

**Copy-ready brief**

Build a small comprehension evaluation for Repo Lore. Evaluate whether the generated output exposes evidence needed to answer useful questions; avoid scoring repository size, rendered widget count, or the number of claims.

Use Repo Lore's own source as a local case study. Verify the answers directly in the current code before writing expectations. Begin with four questions:

1. Where does a submitted repository identifier enter the analysis workflow?
2. What determines the Data Flow page's initial function focus?
3. Where is the rule for visitor-triggered background re-analysis implemented?
4. How are source links tied to the analyzed commit?

Relevant starting points include `src/app/actions.ts`, `src/analysis/analyze-and-persist.ts`, `src/components/lore-shell/DataFlowContent.tsx`, `src/lore/function-ranking.ts`, `src/analysis/background-reanalysis.ts`, and `src/github/urls.ts`. These are starting points, not an answer key: confirm them against the current source.

For each question, record independently verified source locations, what the produced Lore actually exposes, and one of: justified answer, explicit unknown, missing navigation/evidence, or incorrect claim. Unknown is an honest result but does not count as successful task completion. Keep correctness and answerability separate so an agent cannot improve the evaluation by declaring everything unknown.

Reuse existing fixture and analyzer helpers. Put a tiny reproducible fixture in the fast checks; make any expensive analysis of the entire repository an explicit local command. Avoid live GitHub or database requirements in the small evaluation.

**Acceptance:** The evaluation catches a wrong link or unsupported conclusion, reports missing answers honestly, and produces a short actionable report. Expectations come from source review, not the analyzer's output. An agent's success on these questions is a preflight check, not proof that a human can understand the UI. Include a short version of the same questions for a later 15-minute human walkthrough.

---

## Assignment 2 — Misleading repositories

**Copy-ready brief**

Create a very small set of adversarial examples that test whether Repo Lore resists plausible but unsupported interpretations. Start with at most four cases, extending existing fixtures rather than creating a large fixture collection.

Choose cases such as:

- A file named `auth.ts` containing ordinary utility code: its name alone must not establish an authentication subsystem.
- A declared package without a matched source import: the UI should describe the unmatched usage, without concluding that the package is unused or safe to remove.
- A dynamic or default-imported call that the current call extractor cannot resolve: absence of a call edge must not imply the function is never called.
- Nested test/support files: preserve current distinctions between test relationships and production diagram edges.

Read the existing cases in `fixtures/ts-react-app`, `fixtures/ts-library`, `fixtures/js-partial`, `fixtures/mixed-ts-python`, and `fixtures/ts-nested-test-samples`, together with the relevant extractor tests. Use only the cases needed to cover an actual failure mode.

Add assertions at the correct layer: extraction tests for represented facts, presentation tests for what the user is told. Preserve intentional extraction limits. A limitation currently disclosed globally need not become thousands of individual gaps. Do not turn this assignment into an analyzer expansion or force every recorded gap to change the run's status.

**Acceptance:** At least one test protects against an appealing false conclusion, not just a missing field. Production/test filtering remains consistent. Mixed-language and unsupported-capability states stay explicit. Each added fixture is tiny and has a documented reason to exist.

---

## Assignment 3 — Explain this arrow

**Copy-ready brief**

Extend the architecture interaction so selecting an area connection answers: “Why are these two areas connected?”

Inspect `src/components/lore-shell/AreaDependencyDiagram.tsx`, `src/lore/area-diagram-layout.ts`, `src/lore/area-relationships.ts`, `src/lore/model.ts`, and the current inspector/sheet primitives. Reuse the diagram's production-edge derivation. Keep edge direction and exclusions consistent with the actual drawn graph.

For a selected connection, present the importer, imported area, relationship kind, certainty, and available supporting source references. Lead with one short explanation supported by the existing data. Show a small initial evidence list and an explicit way to inspect the remaining references. Distinguish unique source locations, import occurrences, and distinct neighboring areas when displaying counts.

If the rollup cannot provide a specific import statement or line, show the source evidence it actually has. Never invent a line-level explanation from area names.

The repository currently restricts area-diagram interaction to pan/zoom/fit. Follow its scope-review process and document the narrow change needed for inspection. Keep dragging, connecting, graph editing, and generalized file graphs outside this change. Provide keyboard and touch access through an equivalent labeled control or relationship list.

**Acceptance:** A user can get from one visible connection to its actual evidence without losing context. Filtering/highlighting uses the same production relationships as the map. Source links are commit-pinned, mobile access works, and current graph guardrail tests are updated intentionally.

---

## Assignment 4 — Share the exact starting point

**Copy-ready brief**

Make a selected function or structural area shareable as a URL to the existing repository page. The recipient should arrive at the same supported starting point rather than manually finding it again.

Inspect the existing router, entity IDs, Systems slugs, Data Flow selection, and evidence inspectors. Choose one entity kind first: functions are a useful candidate. Verify ID stability and ambiguity before choosing a query parameter format.

Keep selection state local during exploration. Update the shareable URL at a deliberate point and restore valid selection on load. Preserve normal page links, existing query parameters, browser Back/Forward behavior, and analysis snapshot visibility. On an invalid or obsolete target, explain that it is unavailable and show the normal page. A same-named but different symbol must not be silently substituted.

The link identifies an entity in the currently available analysis. It is not a new historical snapshot browser. Make the analyzed commit visible and keep all source references pinned. Do not promise that a selection represents an immutable historical result if the route always loads the latest run.

Use existing clipboard behavior with a manual-copy fallback. Keep tokens bounded and validate them against the page's actual entities.

**Acceptance:** A copied link opens the selected entity in a fresh browser context. Invalid, ambiguous, and changed-analysis targets recover clearly. The feature requires no account, server-side saved progress, branch selector, or new persistence table.

---

## Assignment 5 — Read before editing

**Copy-ready brief**

Prototype a compact “Read before editing” section for a selected function or source area. Its purpose is to suggest a justified reading order using direct evidence already present in Lore.

Start with the selected definition. Add a few distinct resolved callers or importing areas, and directly related tests where the existing model supports them. Identify each relationship precisely: a file-level test association is not proof that a particular function is tested. Include a short reason and source link for each item.

Inspect `src/lore/call-tree.ts`, `src/lore/model.ts`, the structural-area relationships, `testRelationships`, and the current Data Flow inspector. Reuse existing derivations and deterministic ordering. Show at most five useful locations and fewer when evidence is sparse. Deduplicate repeated definitions and near-identical locations.

Present this as a reading aid. Avoid “blast radius,” “safe change,” “all affected code,” runtime coverage, or indirect impact guarantees. When there are no resolved callers, say that no callers were resolved by this analysis. Do not suggest the function is unused.

**Acceptance:** Each recommendation has a specific direct relationship and evidence. A sparse repository produces a short honest list. A test association retains its actual granularity. The first version changes presentation over existing data and adds no new scoring algorithm, analyzer, or dependency.

Treat this as an experiment after the core redesign. Validate whether it helps someone choose a next file; omit it if it merely repeats information already clear in the inspector.

---

## Assignment 6 — Put limits where they matter

**Copy-ready brief**

Make uncertainty useful at the point where a user might otherwise reach the wrong conclusion. Keep the primary finding readable and make its supporting limits available nearby.

Inspect `Evidence`, `Gap`, optional `Gap.affects`, certainty badges, `GapsList`, the analysis rail, and the view-specific inspectors. Bind a gap to an entity only when the model provides an explicit or otherwise defensible association. Keep global gaps global rather than attaching them arbitrarily to every card.

Start with three concrete interpretations to prevent:

1. No resolved callers does not mean never called.
2. An old analysis does not prove a newer commit exists.
3. A directory grouping does not prove a service or architectural boundary.

Use concise local copy and a disclosure for the full evidence/methodology. Preserve Detected, Inferred, Unknown, and Unsupported as separate categories. Keep npm/PyPI package descriptions attributed to the registry; they do not establish the package's architectural role in this particular repository.

**Acceptance:** Tests cover these specific misleading interpretations. Users can inspect the relevant limit without repeatedly reading generic warnings. The presentation does not infer certainty from empty arrays or convert importance scores into confidence scores. Existing useful findings remain accessible during partial analysis.

---

## Assignment 7 — A real example tour

**Copy-ready brief**

Create one short, public walkthrough that lets a prospective user experience the product's value before submitting a repository.

Use one small existing analyzed example selected for readability. Reuse persisted data and existing routes. Build the tour around four actions: understand the repository's shape, choose a starting location, inspect one supported relationship, and open its source evidence.

Inspect `HomeContent`, the homepage route, `src/lib/featured-lores.ts`, existing example data, and the new Overview/inspector components. Repository fame and size should not determine whether an example is useful for this walkthrough. Make a deliberate featured-example choice without introducing a new generalized quality score.

The tour should compose the existing recommendations, relationships, and source references. It must not require handwritten architecture stories for every repository or new customer configuration. If a step is not supported by the selected analysis, choose another valid step or omit it. Keep the ordinary free exploration path available.

Use actual persisted example content, not Trailhead fixture claims presented as live analysis. Avoid new analysis requests on marketing page loads. Preserve the repository form's existing validation, shorthand input, pending state, and error behavior.

Add only a few parameterless events using the existing `trackEvent` helper if needed to observe tour entry, evidence inspection, and onward navigation. Keep the measurement separate from any claim that the tour improves conversion; that requires actual user results.

**Acceptance:** A visitor can complete the four supported actions and reach the full Lore. No login or repository submission is required to try the example. Evidence matches the rendered snapshot, marketing rendering has a graceful missing-example fallback, and there is no additional background analysis or custom analytics infrastructure.

---

## Assignment 8 — A delivery contract

**Append this to each implementation brief**

Before implementing, identify one concrete uncertainty this task will reduce for an unfamiliar engineer and one existing data source that supports the new presentation. Inspect current code rather than relying on the prototype's fictional content.

Keep the change focused. Follow the project's applicable scope/integrity review requirements. Reuse existing primitives and analysis services. Separate an unavailable capability from a presentation improvement; do not silently introduce a broader product to make the screen work.

During verification, use at least one ordinary supported example and one sparse or misleading case. Run the repository-required unit and end-to-end checks for the changed behavior. Inspect desktop/mobile rendering and light/dark appearance, including long paths and open evidence panels. Update old test expectations when behavior changes intentionally.

Provide the visual evidence required by the repository's PR process, along with a concise verification report. The final handoff must distinguish observed results from assumptions. State checks that could not be run; a DOM simulation does not establish browser layout or accessibility. Update user-facing project documentation as required by the repository.

Conclude with the implemented behavior, why it helps, the source of its claims, the meaningful checks performed, and any remaining gap. Keep speculative follow-on features out of the implementation. Do not automatically commit, open a public release, or deploy.

---

## Assignment to defer deliberately

Do not give an agent a blanket instruction to “make the architecture smarter.” Break any such request into a specific observable capability, a source of evidence, and a fixture that can disprove an incorrect result. Multi-area domain grouping, complete request narratives, historical architectural diffs, and runtime tracing need separate product and evidence decisions. A more confident-looking interface is not evidence of better understanding.
