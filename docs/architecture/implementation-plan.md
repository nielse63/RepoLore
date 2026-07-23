# Implementation plan — first vertical slice

This is a living tracking document. Update it at the end of every meaningful session: record what was completed, the exact next smallest task, and any unresolved decisions.

See `docs/product/mvp.md` for what the slice must do and `docs/architecture/decisions/` for why it's built this way.

## Architecture recap

Single Next.js (TypeScript) app, deployed on Fly.io or Railway once a public deployment is needed (ADR-0001). The first slice runs analysis **synchronously and in-process** — no separate worker entrypoint or job queue yet; that design is specified in ADR-0004 but its implementation is deferred until there's a concrete reason (see "Sequencing" below). Source acquisition uses GitHub tarballs (ADR-0002), JavaScript/TypeScript analysis uses ts-morph syntactically (ADR-0003), and results are keyed by `(owner, repo, commit_sha, analyzer_version)` (ADR-0005) once persistence is built. Python analysis needs its own ADR (library/approach) before that work starts — ADR-0003 currently covers JavaScript/TypeScript only.

## Sequencing (revised 2026-07-22 for TypeScript/JavaScript/Python scope)

`docs/product/mvp.md` expanded the supported ecosystem from TypeScript+React only to TypeScript, JavaScript, and Python sharing one language-neutral Lore model, removed scheduled/automatic refresh and health scores/findings from MVP scope, and introduced explicit Detected/Inferred/Unknown/Unsupported certainty categories. `docs/product/mvp.md`'s own recommended sequence is: define the shared Lore model, build JavaScript/TypeScript extraction, validate Start Here and major-area detection against representative repositories, add Python extraction against the same contract, validate Python at the same threshold, test mixed-language repositories, then launch only when every advertised language meets the minimum value contract. This plan follows that sequence.

It also preserves the resequencing from the earlier product-scope review (2026-07-22), which found that building acquisition, persistence, and async-job plumbing before proving the analyzer produces a useful lore inverted the "smallest end-to-end slice" principle. ADR-0001 and ADR-0004 mark the worker/job-queue design as deferred-until-needed rather than a session-1–4 requirement; ADR-0002 defers PAT provisioning to the session that first calls the GitHub API. Managed Postgres provisioning and hosting account setup remain deferred to the sessions that first need them.

## Acceptance criteria for the slice

1. Submitting a valid public GitHub URL analyzes it and shows the result at `/lore/{owner}/{repo}` (synchronously for the first slice; may show a brief loading state).
2. An invalid URL or nonexistent repo produces a clear, honest error — no silent failure.
3. The app resolves the default branch and HEAD commit SHA via an authenticated GitHub API call.
4. The app fetches the repo tarball at that commit and extracts it under enforced size/file-count/time limits, rejecting path-traversal entries.
5. The app detects whether the repo is a supported TypeScript, JavaScript, or Python project, including whether React is present as framework-aware enrichment within a JS/TS project; unsupported repos get an honest "not supported" result, not a crash or fabricated analysis.
6. Source file discovery excludes `node_modules`, build/dist output, virtual environments, and other generated/vendored paths for each supported language.
7. The extracted project model captures project type, source files, per-file imports/exports, internal dependency edges, probable entry points, public surfaces, test relationships, and confidently-detected React components, via syntactic (non-type-checked) parsing — populating one shared, language-neutral Lore model rather than separate per-language report formats.
8. Derived views are computed: repository orientation, a Start Here reading path (~3–7 items, each with rationale, evidence, and a certainty label), a major-area model, entry points, and direct relationships. No health scores or generalized health findings are computed for the MVP.
9. Results are persisted keyed by `(owner, repo, commit_sha, analyzer_version)`; re-analysis at the same commit+analyzer version is idempotent.
10. `/lore/{owner}/{repo}` renders the latest completed run as plain tables/lists, shows the analyzed commit SHA, timestamp, and analyzer version, and links each major claim back to the relevant file on GitHub with a Detected/Inferred/Unknown/Unsupported certainty label.
11. A manual "re-analyze" action re-runs analysis, rate-limited. No scheduled or automatic refresh is implemented for the MVP.
12. An adversarial fixture (oversized files, deep nesting, tar path-traversal attempt) fails safely within limits instead of hanging or crashing the process.
13. JavaScript/TypeScript and Python fixtures each independently satisfy the minimum value contract (orientation, Start Here, major areas, entry points, relationships, evidence/gaps) before the slice is considered launch-ready; a representative mixed-language fixture is presented as one repository-level model without inventing unevidenced cross-language relationships.

Async dispatch (job queue, worker process, crash reaper — ADR-0004) is intentionally not an acceptance criterion for this slice; it's added once synchronous analysis demonstrably needs to become non-blocking.

## Fixture strategy

- `fixtures/ts-react-app/` — hand-built TS+React app: tsconfig with a path alias, one entry point, 2–3 components, one utility module, a `dist/`-like directory to verify exclusion.
- `fixtures/ts-library/` — small plain-TypeScript (non-React) library shape.
- `fixtures/python-app/` — conventional Python application: `pyproject.toml`, `src/` layout, a console-script entry point, a couple of internal modules.
- `fixtures/python-library/` — small Python package with a public surface and a `pytest` test directory.
- `fixtures/unsupported/` — missing/unusual configuration for both language families, exercises the honest "partially supported" path.
- `fixtures/mixed-language/` — small repo containing both a JS/TS project and a Python project, to exercise the repository-level model without inventing cross-language relationships.
- Manual (non-automated) sanity check against 1–2 pinned small real public repos per language, once fixtures pass for that language — pins to be chosen and recorded here later in the plan.

## Sessions (~60–120 min each)

- [x] 1. Scaffold Next.js + TypeScript app, lint/format config, minimal local env config, liveness-only health-check route (no DB, no PAT, no hosting decisions).
- [x] 2. Define the shared, language-neutral Lore model (Repository, AnalysisSnapshot, Project, SourceLocation, StructuralArea, EntryPoint, Relationship, PublicContract, TestRelationship, Recommendation, Evidence, Gap) and the minimum value contract as code-level types, independent of any language extractor.
- [x] 3. Build the two JS/TS local fixture repos; get ts-morph reading a fixture directly from local disk, with source file discovery + exclusion rules.
- [x] 4. ts-morph project model extraction against local fixtures: imports/exports, internal dependency edges, entry-point heuristics, public surface, test relationships, React component detection.
- [ ] 5. Derived views against JS/TS fixtures: Start Here (with rationale, evidence, and certainty per item), major areas, entry points, direct relationships — rendered on a plain unstyled page. This is the session that proves or disproves the core "wow moment" for JS/TS.
- [ ] 6. Validate Start Here and major-area detection against 1–2 pinned real public JS/TS repos; adjust heuristics before moving to acquisition or Python.
- [ ] 7. GitHub URL input, validation/normalization, GitHub API client (default branch + HEAD SHA) — first use of a GitHub PAT.
- [ ] 8. Tarball fetch + safe extraction (size/file-count/time limits, path sanitization) into temp dir, with cleanup; swap the JS/TS analyzer's input from local fixtures to a fetched repo.
- [ ] 9. DB schema + migrations: `repos`, `analysis_runs` (local Postgres or SQLite is enough; managed provider not needed yet).
- [ ] 10. Persist `analysis_run`, idempotent on `(owner, repo, commit_sha, analyzer_version)`; render `/lore/{owner}/{repo}` from persisted JS/TS results with evidence links and certainty labels.
- [ ] 11. Manual re-analysis action (rate-limited) + honest unsupported/failed states.
- [ ] 12. Write an ADR for the Python analysis approach (library and syntactic-vs-typed tradeoff, mirroring ADR-0003), then build the Python extractor against the same shared Lore-model contract: `fixtures/python-app`, `fixtures/python-library`, imports/packages, `pyproject.toml`/`setup.py`/`setup.cfg`, console-script and conventional entry points, `pytest`/`unittest` test relationships.
- [ ] 13. Validate Python Start Here and major-area output against the same usefulness threshold as JS/TS, using local fixtures and 1–2 pinned real public Python repos.
- [ ] 14. Build `fixtures/mixed-language` and confirm the repository-level model presents JS/TS and Python projects together without inventing unevidenced cross-language relationships.
- [ ] 15. Automated tests: analyzer correctness against all fixtures (JS/TS, Python, mixed, unsupported), evidence traceability, failure handling (malformed, oversized, path-traversal attempt).
- [ ] 16. _(Only if needed by then)_ Async dispatch: `analysis_jobs` table, worker entrypoint, `FOR UPDATE SKIP LOCKED` claim, stuck-job reaper (ADR-0004's deferred design).
- [ ] 17. Deploy: choose hosting (Fly.io/Railway) and managed Postgres provider (Neon/Railway), wire secrets, first public deploy.
- [ ] 18. Local dev docs, run-through against fixtures + pinned public repos across all three languages, self-review against `docs/product/mvp.md`'s minimum value contract and success test (Phase 3 of the founding brief).

## Progress log

### 2026-07-22 — Phase 1 complete

Completed: product thesis, risk identification, architecture decision (single deployable + worker, tarball acquisition, ts-morph syntactic analysis, Postgres job queue, result keying), five ADRs, acceptance criteria, fixture strategy, and session breakdown. Architecture validated against solo-maintainer constraints via `product-scope-guardian`. No application code written yet.

### 2026-07-22 — Scope review and resequencing

A second `product-scope-guardian` review of the completed foundation found the original session order (DB + job queue + worker + tarball acquisition, sessions 2–5) front-loaded distributed-systems plumbing before any code proved the analyzer itself is useful — inverting the "smallest end-to-end slice" principle. Revised ADR-0001 and ADR-0004 to mark the worker/job-queue design as deferred-until-needed rather than a session-1–4 requirement; revised ADR-0002 to move PAT provisioning to the session that first calls the GitHub API. Resequenced sessions so the analyzer is proven against local fixtures before acquisition, persistence, and before async dispatch/hosting/deploy. No product requirement changed — only build order and what's provisioned when.

### 2026-07-22 — MVP scope expanded to TypeScript, JavaScript, and Python; plan rewritten

`docs/product/mvp.md`, `docs/MANIFESTO.md`, `docs/PRINCIPLES.md`, `docs/MODEL_OUTPUT.md`, and `PROMPT.md` were rewritten as the new product-foundation source of truth, expanding the supported ecosystem from TypeScript+React only to TypeScript, JavaScript, and Python sharing one language-neutral Lore model; removing scheduled/automatic refresh and health scores/generalized health findings from MVP scope; and introducing explicit Detected/Inferred/Unknown/Unsupported certainty categories. This implementation plan, `CLAUDE.md`, `README.md`, `docs/product/mvp.md`, ADR-0003, and the `.claude/agents/` subagents were rewritten to match. ADR-0003 now explicitly scopes ts-morph analysis to JavaScript/TypeScript only; Python analysis requires its own ADR before session 12 begins. The session breakdown was resequenced to prove JS/TS Start Here/major-area detection first, then add Python against the same contract, per `docs/product/mvp.md`'s recommended implementation sequence. The cron-triggered scheduled-refresh session was removed entirely, since scheduled refresh is now an explicit MVP exclusion rather than a deferred feature.

### 2026-07-22 — Correction: Session 1 was not actually complete

A previous entry in this log claimed Session 1 (Next.js scaffold with `create-next-app`, App Router, TypeScript, ESLint, a liveness-only `/api/health` route) was complete. That claim did not match the working tree: no `src/`, `next.config`, lockfile, or `node_modules` exist, and no `next` dependency is declared anywhere. The only file present was a stray, dependency-free stub `package.json` (apparently left over from an unrelated `npm init`), whose `repository`/`bugs`/`homepage` URLs were also malformed (a literal space where the repo slug belongs). That log entry has been removed as inaccurate; the stub `package.json`'s URLs were corrected to point at the real remote (`nielse63/RepoLore`) but no scaffold, dependencies, or scripts were added. Session 1 is the actual next task.

### 2026-07-22 — Session 1 complete: Next.js scaffold

Scaffolded via `create-next-app` (App Router, TypeScript, ESLint, no Tailwind, `src/` dir, `@/*` import alias) into an isolated temp directory, then merged into the repo root rather than running the generator in place, since the repo already had a real `package.json`, `README.md`, and `.gitignore` that a direct in-place run would have conflicted with or overwritten. The pre-existing `.gitignore` already covered `node_modules/`, `.next`, and `.env*` (with a `!.env.example` exception), so it needed no changes. `package.json`'s prior metadata (`name`, `description`, `repository`, `author`, `license`, `bugs`, `homepage`) was preserved; the stub `main`/`directories`/`type: commonjs` fields and the failing placeholder `test` script were dropped, and `dev`/`build`/`start`/`lint` scripts plus the generated `next`/`react`/`typescript`/`eslint` dependencies were added. Added `.env.example` (empty) and a liveness-only `src/app/api/health/route.ts` (no DB check). Verified locally: `npm run build` succeeds, `npm run lint` passes clean, and `npm run dev` serves `GET /api/health` with `200 {"status":"ok"}`.

`npm install` reports 3 pre-existing transitive vulnerabilities (moderate/high) in `postcss`/`sharp`, pulled in by Next.js itself; `npm audit fix --force`'s only offered fix is downgrading to `next@9.3.3`, which is not a real fix. Left as-is; revisit if `npm audit` offers a real fix at the current Next major version.

**Next smallest task:** Session 2 — define the shared, language-neutral Lore model (Repository, AnalysisSnapshot, Project, SourceLocation, StructuralArea, EntryPoint, Relationship, PublicContract, TestRelationship, Recommendation, Evidence, Gap) and the minimum value contract as code-level types, independent of any language extractor.

**Unresolved decisions (deferred on purpose, not blocking):** exact hosting provider (Fly.io vs. Railway) and managed Postgres provider (Neon vs. Railway Postgres) — deferred to session 17 (deploy); Python analysis library/approach — deferred to session 12's ADR.

### 2026-07-23 — Session 2 complete: shared Lore model

Added `src/lore/model.ts` with the full shared, language-neutral domain model described in `docs/MODEL_OUTPUT.md` ("Shared Lore Domain Model"): `Repository`, `AnalysisSnapshot`, `Project`, `SourceLocation`, `StructuralArea`, `EntryPoint`, `Relationship`, `PublicContract`, `TestRelationship`, `Recommendation`, `Finding`, `Evidence`, `Gap`, plus the aggregate `Lore` type and a shared `CertaintyCategory` (`detected`/`inferred`/`unknown`/`unsupported`). No extractor, persistence, or UI code depends on these types yet — they exist independent of any language extractor, per the session scope.

Also encoded the MVP's minimum value contract (`docs/product/mvp.md`, "Minimum Value Contract") as a `MinimumValueContract` type plus `evaluateMinimumValueContract(lore)`, which checks repository orientation, a Start Here path of 3–7 items each with evidence, a major-area model, entry points, direct relationships, and traceable evidence (every piece of evidence has a source location). This gives session 15 (automated tests) and session 13 (Python validation against the same threshold) a concrete, checkable contract rather than only a documented one. `npx tsc --noEmit` and `npm run lint` both pass clean.

**Next smallest task:** Session 3 — build the two JS/TS local fixture repos (`fixtures/ts-react-app/`, `fixtures/ts-library/`); get ts-morph reading a fixture directly from local disk, with source file discovery and exclusion rules (`node_modules`, build/dist output).

### 2026-07-23 — Session 3 complete: JS/TS fixtures + ts-morph source discovery

Added `ts-morph` (dependency) and `tsx` (devDependency, for running TypeScript scripts without a build step ahead of session 15's test suite).

Built `fixtures/ts-react-app/` (own `tsconfig.json` with a `@/*` path alias, `src/index.tsx` entry point, `App.tsx` composing two components under `src/components/`, `src/utils/format.ts`, and a `dist/bundle.js` stub to verify build-output exclusion) and `fixtures/ts-library/` (plain TypeScript, no React: `src/index.ts` re-exporting a public surface from `src/math.ts`, which itself depends on an internal, non-exported `src/internal/round.ts` — giving session 4 both a public/internal boundary and an internal dependency edge to extract). Each fixture has its own standalone `package.json`/`tsconfig.json` and is excluded from the root app's TypeScript program (`tsconfig.json` `exclude`) since it's a fixture, not application code.

Added `src/analysis/js-ts/discovery.ts`: `discoverSourceFiles(rootDir)` builds a ts-morph `Project` directly from a glob over `rootDir` (`.ts`/`.tsx`/`.js`/`.jsx`), with glob-negation plus a defensive filename-segment check excluding `node_modules`, `dist`, `build`, `out`, `.next`, `coverage`, and `.git` at any depth. Per ADR-0003, this stays syntactic-only — no `tsConfigFilePath`-driven, type-checked `Program` is constructed; only the minimal compiler options needed to parse JSX/TS syntax.

Verified manually (no test suite yet — session 15) via `npm run discover -- <fixture-path>` (`scripts/discover-fixture.ts`): `ts-react-app` correctly discovers all 5 source files and excludes `dist/bundle.js`; `ts-library` correctly discovers all 3 source files. `npx tsc --noEmit` (root and each fixture's own `tsconfig.json`) and `npm run lint` all pass clean.

**Next smallest task:** Session 4 — ts-morph project model extraction against local fixtures: imports/exports, internal dependency edges, entry-point heuristics, public surface, test relationships, React component detection.

### 2026-07-23 — Session 4 complete: JS/TS project model extraction

Added extraction modules under `src/analysis/js-ts/`, each producing pieces of the shared model directly (`@/lore/model`), rather than a separate per-language report format:

- `module-resolution.ts` — resolves relative (`./`, `../`) specifiers to a discovered source file; explicitly does not resolve tsconfig path aliases (ADR-0003 defers that to session 6) and exposes `looksLikePathAlias` so alias imports are surfaced as honest gaps rather than silently dropped.
- `imports.ts` — internal dependency edges (`Relationship`, kind `depends-on`) from both `import` declarations and re-export (`export ... from`) declarations. Unresolved relative imports produce an `unknown` gap; alias-looking imports produce an `unsupported` gap citing ADR-0003.
- `entry-points.ts` — `package.json` `main`/`module`/`bin` fields first (detected), then a React-DOM `render`/`createRoot` bootstrap-call heuristic (detected), then a conventional `src/index.ts(x)` fallback (inferred) only if nothing more specific was found.
- `public-surface.ts` — named exports (including re-exports) reachable from library/runtime entry points, via `SourceFile.getExportedDeclarations()`, which correctly resolves one level of re-export without a type-checked `Program`.
- `tests.ts` — test-to-implementation relationships: a test file's own relative import of its subject (detected) takes priority over filename convention (`foo.test.ts` -> `foo.ts`, inferred); orphaned test files produce an `unknown` gap.
- `react-components.ts` — JSX-returning functions (declarations, arrow functions, function expressions) and classes extending `Component`/`React.Component`/`PureComponent`, all `detected`.
- `extract-project.ts` — orchestrates the above into a `Project` (name, conservatively inferred `kind`, `languages`, `frameworks`) plus the relationships/entry points/public contracts/test relationships/gaps. Project-kind inference is a narrow, disclosed heuristic (bootstrap/CLI entry -> application; bare library manifest field -> library; otherwise left `unknown`) rather than a guess dressed up as fact.

Extended the fixtures to exercise more of this surface: `ts-react-app`'s `Footer` is now an arrow-function component and a new class component (`Greeting.tsx`, extends `Component`) was added, alongside the existing function-declaration component (`App`) — covering all three JSX-detection shapes. `App.tsx` imports `Greeting` via a relative path (resolves to a `detected` relationship) while `Header`/`Footer`/`format` stay behind the `@/*` alias (each correctly surfaces as an `unsupported` gap). `ts-library` gained `src/math.test.ts` (using Node's built-in `node:test`/`node:assert` so it type-checks standalone without adding a test-framework dependency), giving a `detected` test relationship via import.

Verified manually via `npm run extract -- <fixture-path>` (`scripts/extract-fixture.ts`, alongside the session 3 `discover` script): `ts-library` correctly extracts its `library` entry point, 3 internal dependency edges, 3 public contracts (`add`/`multiply`/`divide`), and 1 detected test relationship, with zero gaps. `ts-react-app` correctly infers `kind: "application"` from its bootstrap entry point, detects all 4 React components (one of each shape), extracts the one relative internal edge, and surfaces the 4 alias imports as `unsupported` gaps rather than silently missing them. Root `tsc --noEmit`, both fixtures' own `tsc --noEmit -p tsconfig.json`, and `npm run lint` all pass clean.

**Next smallest task:** Session 5 — derived views against JS/TS fixtures: Start Here (with rationale, evidence, and certainty per item), major areas, entry points, direct relationships — rendered on a plain unstyled page. This is the session that proves or disproves the core "wow moment" for JS/TS.
