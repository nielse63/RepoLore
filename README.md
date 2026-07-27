# Repo Lore

> Repo Lore builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence — without relying on tribal knowledge.

Paste a public GitHub repository URL and Repo Lore produces a stable, readable "lore" page for it at `/lore/{owner}/{repo}`: what the repository contains, where to start reading and why, its major structural areas, probable entry points, and how those areas directly relate. Every important conclusion links back to the source evidence it came from and is labeled **Detected**, **Inferred**, **Unknown**, or **Unsupported**. The MVP does not refresh automatically — you can manually request a fresh analysis after the repository changes.

Repo Lore earns confidence through evidence, not AI narration. Analysis starts with deterministic source and dependency analysis, repository configuration and metadata, and explicit heuristics. AI is not required for the MVP; when introduced, it only explains and organizes findings that have already been established as fact — it never replaces the analysis itself.

## Status

Phase 2 (scaffolding) is underway, and the first end-to-end slice works for JavaScript/TypeScript: paste a public GitHub repository URL on the home page (`/`) and Repo Lore validates it, resolves its default branch and HEAD commit via the GitHub API (`src/github/`), fetches and safely extracts its tarball (`src/acquisition/`), runs the JS/TS analyzer (`src/analysis/js-ts/`) — imports/exports, internal dependency edges, entry points, public surface, test relationships, React components, Start Here and major-area derived views — persists the result to Postgres (`src/db/`, idempotent per ADR-0005), and redirects to a stable `/lore/{owner}/{repo}` page rendering it with a Detected/Inferred/Unknown/Unsupported certainty label on every claim and a GitHub link back to its source. A failed or partially-supported analysis still renders honestly there rather than silently disappearing, and a rate-limited "Re-analyze" button on that page (`src/analysis/reanalysis-rate-limit.ts`) re-checks the repository's HEAD and re-runs analysis if it's moved, reporting honestly when there's nothing new to analyze. Requires `GITHUB_TOKEN` and `DATABASE_URL`. Local fixtures render through the same `Lore` shape at `/fixtures/{name}`. A Python analyzer (`src/analysis/python/`, ADR-0006: tree-sitter-python via `web-tree-sitter`, syntactic-only) now exists and produces the same project/relationships/entry-points/public-contracts/test-relationships shape as the JS/TS analyzer, verified against `fixtures/python-app` and `fixtures/python-library` — but it isn't wired into acquisition, persistence, derived views (Start Here/major areas), or the `/lore` page yet. See `docs/architecture/implementation-plan.md` for the next task and progress log.

The UI now has a full design system (see "Design system and UI routes" below) applied to the home page and the real `/lore/{owner}/{repo}` overview, plus every other view from `docs/designs/` scaffolded under `/lore/{owner}/{repo}/*` with static example content, since the analysis behind them (architecture detection, systems, dependencies, data flow, history, search, change impact) doesn't exist yet.

## Initial scope

- Public GitHub repositories only (no auth, no private repos, no payments yet).
- TypeScript, JavaScript, and Python applications and libraries, sharing one language-neutral Lore model. React is framework-aware enrichment within the JavaScript/TypeScript analyzer, not a separate product.
- One deterministic vertical slice: submit a URL, get a Lore page with repository orientation, a "Start Here" reading path, a major-area model, probable entry points and direct relationships, and evidence with explicit gaps — all traceable to source.

See `docs/product/mvp.md` for the full MVP specification, `docs/product/mission.md` and `docs/product/non-goals.md` for the broader product foundation, and `docs/architecture/decisions/` for the technical decisions behind the first slice. `docs/designs/` holds UI mockups (one image per view) that any UI work should be based on; file names don't map directly to URL routes.

## Design system and UI routes

The UI is built with Tailwind CSS v4 (`src/app/globals.css` defines the color/font tokens as CSS custom properties, themed for light and dark via `prefers-color-scheme`) plus a handful of Radix UI primitives (`@radix-ui/react-tabs`, `-switch`) for accessible tab and toggle behavior, and `lucide-react` for icons. Reusable design-system components live in `src/components/ui/` (Card, Badge, IconTile, Button, Tabs, Table, SearchInput, FilterPills, StepList, …) and the shared `/lore/{owner}/{repo}` page shell (Sidebar, TopBar, RepoIdentity, RightRailShell, LorePageFrame) lives in `src/components/lore-shell/`. Headings use a serif display font (Source Serif 4) paired with Geist Sans for UI text, matching `docs/designs/`.

Every view from `docs/designs/` has a route under `/lore/{owner}/{repo}/`:

- **Real, backed by actual analysis:** the overview page (`/lore/{owner}/{repo}`, `repository-overview.png`) and the home page (`/`, `home.png`).
- **Scaffolded with static example content** (an `acme/payments-service`-style fixture, defined in `src/lib/fixtures/payments-service.ts`), since the underlying analysis doesn't exist yet: `architecture`, `systems` (list, `systems/{system}` detail, and `systems/{system}/change-impact`), `dependencies`, `data-flow`, `history`, `repository-settings`, and `search`. Each renders a `PreviewBanner` disclosing that it's example data, and their "Re-analyze"/export/save actions are visibly present but inert. `change-impact` and `history` in particular mirror capabilities explicitly excluded from the MVP (`docs/product/mvp.md`, "Explicit MVP Exclusions") — they exist as design-system scaffolding, not a scope commitment.
- **Deliberately not built:** `evidence-library.png` (inconsistent with the rest of the design set; deferred for later reconciliation, per product direction).

## Local development

```
npm install
npm run dev    # start the dev server (serves /api/health as a liveness-only check, no DB)
npm run build  # production build
npm run start  # run the production build
npm run lint   # ESLint
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

`fixtures/` holds small, hand-built local repos used to develop and sanity-check each language analyzer before it's run against real repositories (see `docs/architecture/implementation-plan.md`, "Fixture strategy"). No automated test suite exists yet (session 15), so two scripts give manual sanity checks against a fixture:

```
npm run discover -- fixtures/ts-react-app   # source file discovery + exclusion rules
npm run extract -- fixtures/ts-react-app    # full JS/TS project extraction
npm run derive -- fixtures/ts-react-app     # Start Here + major-area derived views
npm run discover -- fixtures/ts-library
npm run extract -- fixtures/ts-library
npm run derive -- fixtures/ts-library
```

With `npm run dev` running, the same derived views render on a plain, unstyled page at `/fixtures/ts-react-app` and `/fixtures/ts-library` (index at `/fixtures`).

The Python analyzer (`src/analysis/python/`) has its own sanity-check script, mirroring `extract` above — it doesn't yet have `discover`/`derive` equivalents or a `/fixtures` page, since source discovery is folded into extraction and derived views (Start Here/major areas) don't exist for Python yet:

```
npm run extract-python -- fixtures/python-app
npm run extract-python -- fixtures/python-library
```

## Analyzing a real repository from the command line

`npm run analyze-repo` runs the fetch-extract-analyze path against any real public GitHub repository without touching the database — useful for quickly checking analyzer output on a new repo:

```
npm run analyze-repo -- https://github.com/sindresorhus/globby
```

This resolves the repository's default branch and HEAD commit, downloads and safely extracts its tarball into a temp directory (`src/acquisition/`), runs the same JS/TS extraction and derived-view logic used for local fixtures against it, prints Start Here / major areas / entry points / gaps, and always cleans up the temp directory afterward. Requires `GITHUB_TOKEN`. The real web flow (home page → `/lore/{owner}/{repo}`) additionally persists the result — see below.

## Database

`repos` and `analysis_runs` (ADR-0004, ADR-0005) are plain hand-written SQL files under `src/db/migrations/`, applied in filename order by `npm run migrate` (`scripts/migrate.ts`), which tracks what's already applied in a `schema_migrations` table — no migration framework yet, since a couple of tables don't justify one. `analysis_runs` is keyed by `(repo_id, commit_sha, analyzer_version)` (ADR-0005) and stores the full serialized `Lore` (`src/lore/model.ts`) as `result jsonb` on success, or `error_message` on failure; `status` matches `AnalysisSnapshot['status']` (`completed`/`partial`/`failed`) exactly. Requires `DATABASE_URL` (see .env.example); `docker compose up -d db` runs a matching local Postgres.

Submitting the home page's form (`src/app/actions.ts`) calls `analyzeAndPersistRepository` (`src/analysis/analyze-and-persist.ts`), which resolves the repo's HEAD, short-circuits if that exact commit+analyzer-version has already been analyzed (ADR-0005 idempotency — no redundant tarball fetch on repeat submissions), and otherwise acquires, analyzes, persists, and redirects to `/lore/{owner}/{repo}`. Every outcome — success, partial, or failed — is persisted and rendered there; nothing is silently dropped.

The "Re-analyze" button on `/lore/{owner}/{repo}` calls the same `analyzeAndPersistRepository`, rate-limited per repository (`repos.last_analysis_requested_at`, `src/analysis/reanalysis-rate-limit.ts`, one attempt per 60 seconds by default) so a rapid click can't repeatedly burn through the shared GitHub token's rate limit even when the analysis itself short-circuits on an unchanged commit. There's no scheduled/automatic refresh in the MVP — this manual action is the only way to pick up new commits.
