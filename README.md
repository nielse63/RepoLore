# Repo Lore

> Repo Lore builds a living, evidence-backed mental model of a software repository so an unfamiliar engineer can understand it with justified confidence — without relying on tribal knowledge.

Paste a public GitHub repository URL and Repo Lore produces a stable, readable "lore" page for it at `/lore/{owner}/{repo}`: what the repository contains, where to start reading and why, its major structural areas, probable entry points, and how those areas directly relate. Every important conclusion links back to the source evidence it came from and is labeled **Detected**, **Inferred**, **Unknown**, or **Unsupported**. The MVP does not refresh automatically — you can manually request a fresh analysis after the repository changes.

Repo Lore earns confidence through evidence, not AI narration. Analysis starts with deterministic source and dependency analysis, repository configuration and metadata, and explicit heuristics. AI is not required for the MVP; when introduced, it only explains and organizes findings that have already been established as fact — it never replaces the analysis itself.

## Status

Phase 2 (scaffolding) is underway. A Next.js (App Router, TypeScript) app lives at the repo root, the shared, language-neutral Lore domain model (`src/lore/model.ts`) is defined, and the JS/TS analyzer (`src/analysis/js-ts/`) reads a project from disk and extracts imports/exports, internal dependency edges, entry points, public surface, test relationships, and React components — validated against local fixtures and four real public repositories. Start Here and major-area derived views (`src/analysis/js-ts/derive-views.ts`) render on a plain, unstyled page at `/fixtures/{name}`. The home page (`/`) accepts a pasted GitHub repository URL, validates/normalizes it, and resolves its default branch and HEAD commit SHA via the GitHub API (`src/github/`), requiring a `GITHUB_TOKEN`. Source acquisition (`src/acquisition/`) can now fetch a repository's tarball at that commit and safely extract it into a temp directory — enforcing hard caps on download size, extracted size, and file count, rejecting unsafe tar entries (symlinks, path traversal) — and the JS/TS analyzer runs unmodified against that fetched directory (`npm run analyze-repo`). The Postgres schema (`src/db/migrations/`) for `repos` and `analysis_runs` exists and is migrated via `npm run migrate`, but nothing writes to it yet — no persistence or `/lore/{owner}/{repo}` page. See `docs/architecture/implementation-plan.md` for the next task and progress log.

## Initial scope

- Public GitHub repositories only (no auth, no private repos, no payments yet).
- TypeScript, JavaScript, and Python applications and libraries, sharing one language-neutral Lore model. React is framework-aware enrichment within the JavaScript/TypeScript analyzer, not a separate product.
- One deterministic vertical slice: submit a URL, get a Lore page with repository orientation, a "Start Here" reading path, a major-area model, probable entry points and direct relationships, and evidence with explicit gaps — all traceable to source.

See `docs/product/mvp.md` for the full MVP specification, `docs/product/mission.md` and `docs/product/non-goals.md` for the broader product foundation, and `docs/architecture/decisions/` for the technical decisions behind the first slice.

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

## Analyzing a real repository from the command line

Before persistence and the `/lore/{owner}/{repo}` page exist, `npm run analyze-repo` proves the fetch-and-extract-and-analyze path end to end against any real public GitHub repository:

```
npm run analyze-repo -- https://github.com/sindresorhus/globby
```

This resolves the repository's default branch and HEAD commit, downloads and safely extracts its tarball into a temp directory (`src/acquisition/`), runs the same JS/TS extraction and derived-view logic used for local fixtures against it, prints Start Here / major areas / entry points / gaps, and always cleans up the temp directory afterward. Requires `GITHUB_TOKEN`.

## Database

`repos` and `analysis_runs` (ADR-0004, ADR-0005) are plain hand-written SQL files under `src/db/migrations/`, applied in filename order by `npm run migrate` (`scripts/migrate.ts`), which tracks what's already applied in a `schema_migrations` table — no migration framework yet, since a couple of tables don't justify one. `analysis_runs` is keyed by `(repo_id, commit_sha, analyzer_version)` (ADR-0005) and stores the full serialized `Lore` (`src/lore/model.ts`) as `result jsonb` on success, or `error_message` on failure; `status` matches `AnalysisSnapshot['status']` (`completed`/`partial`/`failed`) exactly. Requires `DATABASE_URL` (see .env.example); `docker compose up -d db` runs a matching local Postgres.
