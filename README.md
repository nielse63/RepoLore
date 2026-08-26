# Repo Lore

> Repo Lore builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence — without relying on tribal knowledge.

Paste a public GitHub repository URL and Repo Lore produces a stable, readable "lore" page for it at `/lore/{owner}/{repo}`: what the repository contains, where to start reading and why, its major structural areas, probable entry points, and how those areas directly relate. Every important conclusion links back to the source evidence it came from and is labeled **Detected**, **Inferred**, **Unknown**, or **Unsupported**. The MVP does not refresh automatically — you can manually request a fresh analysis after the repository changes.

Repo Lore earns confidence through evidence, not AI narration. Analysis starts with deterministic source and dependency analysis, repository configuration and metadata, and explicit heuristics. AI is not required for the MVP; when introduced, it only explains and organizes findings that have already been established as fact — it never replaces the analysis itself.

## Status

Phase 2 (scaffolding) is underway, and the first end-to-end slice works for JavaScript/TypeScript: paste a public GitHub repository URL on the home page (`/`) and Repo Lore validates it, resolves its default branch and HEAD commit via the GitHub API (`src/github/`), fetches and safely extracts its tarball (`src/acquisition/`), runs the JS/TS analyzer (`src/analysis/js-ts/`) — imports/exports, internal dependency edges, entry points, public surface, test relationships, React components, an application-vs-library `project.kind` inference (manifest `main`/`exports` shape, overridden by a detected UI framework dependency or UI components in source), Start Here and major-area derived views — persists the result to Postgres (`src/db/`, idempotent per ADR-0005), and redirects to a stable `/lore/{owner}/{repo}` page rendering it with a Detected/Inferred/Unknown/Unsupported certainty label on every claim and a GitHub link back to its source. A failed or partially-supported analysis still renders honestly there rather than silently disappearing, and a rate-limited "Re-analyze" button on that page (`src/analysis/reanalysis-rate-limit.ts`) re-checks the repository's HEAD and re-runs analysis if it's moved, reporting honestly when there's nothing new to analyze. Requires `GITHUB_TOKEN` and `DATABASE_URL`. A Python analyzer (`src/analysis/python/`, ADR-0006: tree-sitter-python via `web-tree-sitter`, syntactic-only) now exists and produces the same project/relationships/entry-points/public-contracts/test-relationships shape as the JS/TS analyzer, plus its own Start Here/major-area derived views (`src/analysis/python/derive-views.ts`, sharing a language-neutral core with JS/TS at `src/analysis/shared/derive-views.ts`) — validated against `fixtures/python-app`, `fixtures/python-library`, and three real public Python repositories. Every real `/lore/{owner}/{repo}` submission now runs a real language-detection dispatch step (ADR-0007, `src/analysis/dispatch/`): GitHub's byte-weighted `languages` API decides which analyzer(s) actually run, every supported language (JavaScript/TypeScript together, or Python) at or above a 10% byte share gets its own analyzer run and its own project in the result, and a repository whose language isn't supported at all is honestly persisted as a failed run naming what GitHub actually detected, rather than silently analyzed as the wrong language. See `docs/architecture/implementation-plan.md` for the next task and progress log.

The UI now has a full design system (see "Design system and UI routes" below) applied to the home page, the real `/lore/{owner}/{repo}` overview, the real `/lore/{owner}/{repo}/architecture` page (ADR-0008), the real `/lore/{owner}/{repo}/history` page (ADR-0010, a deliberate, scoped override of the MVP's commit-history-analysis exclusion — see below), and the real `/lore/{owner}/{repo}/dependencies` page (ADR-0011: external dependency extraction from `package.json`/`pyproject.toml`, matched against import usage, plus a live npm/PyPI registry description lookup and an Internal tab reusing Architecture's area-relationship data), plus every other view from `docs/designs/` scaffolded under `/lore/{owner}/{repo}/*` with static example content, since the analysis behind them (data flow, search) doesn't exist yet. Systems (and its `change-impact` subview) is deferred as a future feature and no longer routable — see "Design system and UI routes" below.

## Initial scope

- Public GitHub repositories only (no auth, no private repos, no payments yet).
- TypeScript, JavaScript, and Python applications and libraries, sharing one language-neutral Lore model. React is framework-aware enrichment within the JavaScript/TypeScript analyzer, not a separate product.
- One deterministic vertical slice: submit a URL, get a Lore page with repository orientation, a "Start Here" reading path, a major-area model, probable entry points and direct relationships, and evidence with explicit gaps — all traceable to source.

See `docs/product/mvp.md` for the full MVP specification, `docs/product/mission.md` and `docs/product/non-goals.md` for the broader product foundation, and `docs/architecture/decisions/` for the technical decisions behind the first slice. `docs/designs/` holds UI mockups (one image per view) that any UI work should be based on; file names don't map directly to URL routes.

## Design system and UI routes

The UI is built with Tailwind CSS v4 (`src/app/globals.css` defines the color/font tokens as CSS custom properties, themed for light and dark via `prefers-color-scheme`) plus a handful of Radix UI primitives (`@radix-ui/react-tabs`, `-switch`) for accessible tab and toggle behavior, and `lucide-react` for icons. Reusable design-system components live in `src/components/ui/` (Card, Badge, IconTile, Button, Tabs, Table, SearchInput, FilterPills, StepList, …) and the shared `/lore/{owner}/{repo}` page shell (Sidebar, TopBar, RepoIdentity, RightRailShell, LorePageFrame) lives in `src/components/lore-shell/`. Headings use a serif display font (Source Serif 4) paired with Geist Sans for UI text, matching `docs/designs/`.

Every view from `docs/designs/` has a route under `/lore/{owner}/{repo}/`:

- **Real, backed by actual analysis:** the overview page (`/lore/{owner}/{repo}`, `repository-overview.png`), the home page (`/`, `home.png`), the architecture page (`/lore/{owner}/{repo}/architecture`, `architecture.png`), the history page (`/lore/{owner}/{repo}/history`, `history.png`), and the dependencies page (`/lore/{owner}/{repo}/dependencies`, `dependencies.png`). Overview and Architecture render only what the `Lore` model already produces — Major Areas, the direct relationships between them, Entry Points, and each project's `frameworks` — as evidence-backed lists/tables, per **ADR-0008**: no infrastructure/data-store detection, no framework detection beyond what the analyzers already support, and no "architectural boundaries" narrative claims, since none of those are backed by real evidence today. As a narrow, deliberate exception recorded in **ADR-0009**, the Major-Area relationships are additionally shown as a static, non-interactive dependency diagram (`@dagrejs/dagre` for layout only, rendered server-side as SVG — no pan/zoom/drag, no file-level graph) on both pages. History is itself a deliberate, scoped override of the MVP's commit-and-pull-request-history-analysis exclusion (product owner's explicit decision, against a `product-scope-guardian` recommendation not to build it yet): it lists commits from the GitHub API (`src/github/commits.ts`), classifies each commit's diff via deterministic regex/path-convention heuristics against the last persisted `Lore` (`src/history/classify.ts` — dependency-manifest, cross-area relative-import, and data-layer-path changes, every fact `inferred`/`unknown` certainty, never `detected`), and describes entries with fixed templates rather than an LLM call. It deliberately omits the mockup's before/after diagram, Evidence Library link, and interactive date-range picker. Dependencies (**ADR-0011**) extracts real external (`package.json`/`pyproject.toml`) dependencies and matches them to importing files — `detected` for JS/TS's exact bare-specifier match, `inferred` for Python's name-normalization match, since Python import names often differ from their PyPI distribution name — with two deliberate overrides of that ADR's own scope-guardian review: a live npm/PyPI registry description lookup (bounded, non-fatal, no cross-repo cache in v1) and a small, closed, purely cosmetic package-name-to-icon category map. Its Internal tab reuses Architecture's area-relationship data rather than computing anything new. Data Flow (**ADR-0012**) renders a function-level call tree — named functions/methods/arrow-function-expressions and the statically-resolved direct calls between them (JS/TS only; syntactic, never type-checked) — rooted at the repo's exported and framework-entry-point functions (`src/lore/call-tree.ts`), each row expandable in place to reveal its callees, arbitrarily nested, with a right-rail detail panel (parameters, return type, callers/callees, evidence) that updates as you drill down. A prior interactive diagram view has been removed pending a revisit once the tree view has seen more real repos. See `docs/architecture/decisions/0008-architecture-page-real-data-scope.md`, `docs/architecture/decisions/0009-area-dependency-diagram.md`, `docs/architecture/decisions/0010-history-page-real-data-scope.md`, `docs/architecture/decisions/0011-dependencies-page-real-data-scope.md`, and `docs/architecture/decisions/0012-call-graph.md` for the full reasoning.
- **Scaffolded with static example content** (an `acme/payments-service`-style fixture, defined in `src/lib/fixtures/payments-service.ts`), since the underlying analysis doesn't exist yet: `repository-settings` and `search`. Each renders a `PreviewBanner` disclosing that it's example data, and their "Re-analyze"/export/save actions are visibly present but inert.
- **Deliberately not built:** `evidence-library.png` (inconsistent with the rest of the design set; deferred for later reconciliation, per product direction).
- **Built, then pulled from navigation:** `systems` (list, `systems/{system}` detail, and `systems/{system}/change-impact`, including the `change-impact` view that mirrors a capability explicitly excluded from the MVP per `docs/product/mvp.md`, "Explicit MVP Exclusions") is deferred as a future feature. The Sidebar link is commented out, and the scaffolded pages still exist for reference under `src/app/lore/[owner]/[repo]/_systems/` — the `_` prefix excludes them from Next.js routing. `/lore/{owner}/{repo}/systems` and everything under it now resolve through a catch-all stub (`systems/[[...slug]]/page.tsx`) that calls `notFound()`, rendering the app-wide branded 404 page (`src/app/not-found.tsx`).

## Local development

```
npm install
npm run dev    # start the dev server (serves /api/health as a liveness-only check, no DB)
npm run build  # production build
npm run start  # run the production build
npm run lint   # ESLint
npm test               # run the Jest unit test suite
npm run test:coverage  # Jest unit test suite with a coverage report
npm run test:e2e       # run the Playwright functional/UI test suite
```

A GitHub personal access token is now required to resolve a repository from the home page (no scopes needed for public repos — see `.env.example`):

```
cp .env.example .env.local
# fill in GITHUB_TOKEN in .env.local
```

A local Postgres database is required for the DB schema/migrations (`src/db/`); a managed hosting account is not needed yet (see `docs/architecture/implementation-plan.md`):

```
docker compose up -d db   # starts local Postgres (see docker-compose.yml)
npm run migrate           # applies src/db/migrations/
```

## Fixtures

`fixtures/` holds small, hand-built local repos used to develop and sanity-check each language analyzer before it's run against real repositories (see `docs/architecture/implementation-plan.md`, "Fixture strategy"). Two scripts also give manual, human-readable sanity checks against a fixture (in addition to the automated unit test suite — see "Testing" below):

```
npm run discover -- fixtures/ts-react-app   # source file discovery + exclusion rules
npm run extract -- fixtures/ts-react-app    # full JS/TS project extraction
npm run derive -- fixtures/ts-react-app     # Start Here + major-area derived views
npm run discover -- fixtures/ts-library
npm run extract -- fixtures/ts-library
npm run derive -- fixtures/ts-library
```

The Python analyzer (`src/analysis/python/`) has its own equivalent scripts (source discovery is folded into extraction, so there's no separate `discover-python`):

```
npm run extract-python -- fixtures/python-app
npm run derive-python -- fixtures/python-app
npm run extract-python -- fixtures/python-library
npm run derive-python -- fixtures/python-library
```

Each local fixture also has a matching private GitHub repository (`nielse63/repo-lore-{ts-react-app,ts-library,python-app,python-library}-fixture`) with the same source, used to exercise the real submit → analyze → `/lore/{owner}/{repo}` flow end-to-end.

## Testing

Automated tests are both unit (Jest) and functional (Playwright).

### Unit tests (Jest)

Every source file under `src/` has a matching Jest unit test at `<same-directory>/__tests__/<file>.spec.ts`. Run the full suite with `npm test` (`npm run test:watch` for watch mode, `npm run test:coverage` for a coverage report).

- Jest is configured via `next/jest` (`jest.config.ts`), which handles the Next.js/SWC transform; tests run in the `node` environment (no jsdom/UI component tests — that's what the Playwright suite below covers).
- The JS/TS analyzer tests (`src/analysis/js-ts/`) exercise a real in-memory `ts-morph` `Project` rather than mocking its AST — ts-morph is a pure, in-process parser with no network or native-binding dependency, so this is both more realistic and simpler than hand-mocking `SourceFile` objects.
- The Python analyzer tests (`src/analysis/python/`) similarly parse small real Python source snippets with the real `tree-sitter-python` grammar (`createPythonParser`/`parsePythonSource`) rather than mocking tree-sitter's `Node` interface — it's a bundled, offline WASM grammar with no network dependency. Because `web-tree-sitter` loads that grammar via a dynamic `import()`, the `test`/`test:watch` scripts set `NODE_OPTIONS=--experimental-vm-modules` so Jest's module VM can support it.
- Genuine external I/O — `pg` (`src/db/`), the GitHub REST API (`src/github/client.ts`), and orchestration layers that depend on either — is mocked with `jest.mock`.
- Filesystem-heavy modules (tarball extraction, source discovery, config-file reading) that don't touch the network are tested against real temporary directories (`fs/promises.mkdtemp`) rather than mocked, since real disk I/O in a scratch dir is simpler and more trustworthy than reimplementing `fs`'s contract.

### Functional/UI tests (Playwright)

`e2e/` holds a Playwright suite (`playwright.config.ts`) that drives real pages in an actual browser (Chromium only, for speed). Run it with `npm run test:e2e` — Playwright starts `npm run dev` itself if nothing is already listening on `http://localhost:3000` (or reuses an already-running `next dev` locally).

- Mostly scoped to pages/paths needing no `GITHUB_TOKEN` or database: the home page's client-side/pre-analysis URL validation (`src/github/parse-repo-url.ts`, exercised before any GitHub API call would happen, `e2e/home.spec.ts`, which also checks for broken same-origin links, failed asset/network requests, and console errors on load) and the app-wide not-found page (`src/app/not-found.tsx`, `e2e/not-found.spec.ts`) for an unmatched top-level route, including its referrer-based "Back to Repo Lore" behavior (`src/lib/back-destination.ts`, unit-tested separately). `e2e/not-found.spec.ts` also covers `/lore/{owner}/{repo}` 404s, which need `DATABASE_URL` (but not `GITHUB_TOKEN`): it reads the already-persisted `completed` analysis run for the pinned private fixture `nielse63/repo-lore-ts-react-app-fixture` (see "Fixtures" above) to confirm `/lore/{owner}/{repo}` renders the real lore report rather than 404ing, that an unmatched subpage beneath it (e.g. `/lore/{owner}/{repo}/page-does-not-exist`) 404s instead, and that "Back to Repo Lore" returns there rather than to home. The real submit → analyze → `/lore/{owner}/{repo}` flow, and the `/lore/{owner}/{repo}/systems` 404 (its layout loads the analysis run from Postgres before the redirect ever runs), aren't covered here yet.
- Not currently wired into the Husky pre-commit hook (Jest is) — the browser + dev-server startup cost makes it a slower, separately-run check for now.
- `npx playwright show-report` opens the HTML report of the last run (pass/fail, timings, traces on retry). Failing tests attach a screenshot (`screenshot: "only-on-failure"` in `playwright.config.ts`), viewable in that same report.
- Every run also collects Chromium V8 coverage (`e2e/coverage.ts`, an automatic fixture) into a `monocart-reporter` coverage report at `coverage/e2e/` (`index.html` plus `lcov.info`) — a separate report from the one `show-report` opens.
- `eslint-plugin-playwright`'s recommended rules lint `e2e/**/*.spec.ts` (see `eslint.config.mjs`).

## Analyzing a real repository from the command line

`npm run analyze-repo` runs the fetch-extract-analyze path against any real public GitHub repository without touching the database — useful for quickly checking analyzer output on a new repo:

```
npm run analyze-repo -- https://github.com/sindresorhus/globby
```

This resolves the repository's default branch and HEAD commit, downloads and safely extracts its tarball into a temp directory (`src/acquisition/`), runs the same JS/TS extraction and derived-view logic used for local fixtures against it, prints Start Here / major areas / entry points / gaps, and always cleans up the temp directory afterward. Requires `GITHUB_TOKEN`. The real web flow (home page → `/lore/{owner}/{repo}`) additionally persists the result — see below.

`npm run analyze-python-repo` is the same thing for the Python analyzer:

```
npm run analyze-python-repo -- https://github.com/neubig/starter-repo
```

Neither script runs the language-detection dispatch that the real `/lore/{owner}/{repo}` flow does (ADR-0007) — each always runs its one named analyzer regardless of what the repository actually contains, so they're for checking a single analyzer's output in isolation, not for reproducing what a real submission would do.

## Database

`repos` and `analysis_runs` (ADR-0004, ADR-0005) are plain hand-written SQL files under `src/db/migrations/`, applied in filename order by `npm run migrate` (`scripts/migrate.ts`), which tracks what's already applied in a `schema_migrations` table — no migration framework yet, since a couple of tables don't justify one. `analysis_runs` is keyed by `(repo_id, commit_sha, analyzer_version)` (ADR-0005) and stores the full serialized `Lore` (`src/lore/model.ts`) as `result jsonb` on success, or `error_message` on failure; `status` matches `AnalysisSnapshot['status']` (`completed`/`partial`/`failed`) exactly. Requires `DATABASE_URL` (see .env.example); `docker compose up -d db` runs a matching local Postgres.

Submitting the home page's form (`src/app/actions.ts`) calls `analyzeAndPersistRepository` (`src/analysis/analyze-and-persist.ts`), which resolves the repo's HEAD and GitHub's language breakdown, decides which analyzer(s) to run (ADR-0007's dispatch — `src/analysis/dispatch/detect-languages.ts`), short-circuits if that exact commit+analyzer-set has already been analyzed (ADR-0005 idempotency — no redundant tarball fetch on repeat submissions), and otherwise acquires the source once, runs every selected analyzer, enriches each extracted external dependency with a registry description (`src/registry/`, ADR-0011 — bounded, non-fatal, no `GITHUB_TOKEN`/auth needed since the npm and PyPI registries are public), merges everything into one `Lore`, persists it, and redirects to `/lore/{owner}/{repo}`. Every outcome — success, partial, or failed (including "no supported language was detected") — is persisted and rendered there; nothing is silently dropped.

The "Re-analyze" button on `/lore/{owner}/{repo}` calls the same `analyzeAndPersistRepository`, rate-limited per repository (`repos.last_analysis_requested_at`, `src/analysis/reanalysis-rate-limit.ts`, one attempt per 60 seconds by default) so a rapid click can't repeatedly burn through the shared GitHub token's rate limit even when the analysis itself short-circuits on an unchanged commit. There's no scheduled/automatic refresh in the MVP — this manual action is the only way to pick up new commits.

## Deployment

Hosted on [Render](https://render.com) (free web service — a real long-running Node process per ADR-0001, not a serverless function) with [Neon](https://neon.tech) (free Postgres) — see `docs/architecture/implementation-plan.md`, session 17's 2026-08-25 log entry, for why these over Fly.io/Railway (both dropped their free tiers) and Render's own Postgres (free databases there expire after 30 days).

`render.yaml` at the repo root is a Render [Blueprint](https://render.com/docs/blueprint-spec): `npm install && npm run build` to build, `npm run start` to run, `/api/health` as the health check path. `GITHUB_TOKEN` and `DATABASE_URL` are marked `sync: false`, so Render prompts for their real values in its dashboard at blueprint-creation time rather than reading them from this file — they are never committed.

First deploy, one-time setup:

1. Create a free [Neon](https://neon.tech) project and copy its pooled connection string (includes `?sslmode=require`, which `pg` honors automatically — no code change needed).
2. Apply the schema to it: `DATABASE_URL=<neon-connection-string> npm run migrate`.
3. Create a free [Render](https://render.com) account, connect it to this GitHub repo, and deploy `render.yaml` as a Blueprint. When prompted, paste the real `GITHUB_TOKEN` (see `.env.example`) and the Neon connection string as `DATABASE_URL`.

Render's free tier spins the service down after 15 minutes idle (30–60s cold start on the next request) — an accepted trade-off while there's no live traffic or custom domain yet. Subsequent deploys happen automatically on push to `main`; re-run `npm run migrate` against the Neon `DATABASE_URL` after any change to `src/db/migrations/`.
