# ADR-0017: Indexable Lore Overviews, with crawler visits excluded from ADR-0013's pull trigger

## Status

Accepted

## Context

Every `/lore/{owner}/{repo}/**` route was marked `noindex, follow` during the 2026-08-26 UX/SEO/accessibility remediation (`docs/architecture/ux-seo-a11y-remediation-plan.md`, RL-004/RL-005). The reasoning then was that these pages render one specific analysis run rather than evergreen content, and the app had no indexing intent yet, so it was better to say `noindex` explicitly than to leave it ambiguous. That left the home page as the only page search engines could list.

`docs/MARKETING.md` identifies the stable, public Lore URL as the main source of traffic. People already search for phrases like "how is X structured" and "X codebase architecture", and a good Lore answers that kind of query. The plan flagged indexing as a product call to run through `product-scope-guardian` before shipping. The `product-scope-guardian` review recommended making Lore pages indexable, and the product owner accepted that recommendation (2026-10-17).

Indexing has one interaction with existing scope. ADR-0013 lets an actual page view of a stale repository (latest analysis over a day old) pull-trigger a background re-analysis attempt. Once pages are indexable, crawlers will fetch them regularly. If a crawler fetch counted as a page view, it would be the visitor-less, unattended refresh that `docs/product/non-goals.md` excludes.

## Decision

1. **Only a repository's Overview (`/lore/{owner}/{repo}`) can be indexed, and only when `isIndexableLore` holds for its latest run** (`src/lib/lore-indexability.ts`). The latest run is the one the page renders, and it must:
   - be `completed` (a `partial` run's gaps are material to what it shows; a `failed` run would be a thin page);
   - be for a public repository (private repositories are already rejected at submission; this check is a second guard so the sitemap can never list one);
   - have found at least one entry point and at least one structural area.

   An Overview that qualifies is `index, follow`. Every other Overview stays `noindex, follow`.

2. **Subviews (Architecture, Systems, Dependencies, Data Flow, History, and the Systems subviews) stay `noindex, follow`.** That gives each repository one strong page in search results instead of several thin ones that compete with each other. `buildLoreMetadata` (`src/lib/route-metadata.ts`) defaults to `noindex`, and only the Overview passes `indexable`.
3. **One rule, shared by every surface that advertises a page.** `src/app/sitemap.ts` lists the home page plus every Overview that `isIndexableLore` accepts. It reads only the facts that rule needs, through a SQL projection (`listLatestRunIndexabilityFacts`), so it never loads a full `result` JSONB, and it reads per request rather than at build time. The per-repository Open Graph card (`opengraph-image.tsx`) shows entry point and area counts only under the same rule; otherwise it falls back to a generic tagline. As a result, the sitemap never lists a page whose own metadata says `noindex`, and a social card never shows counts the page can't back up.
4. **`src/app/robots.ts` allows every crawler everywhere except `/api/`** and points at the sitemap. Which repository pages actually get indexed is decided per page, as described above, not in `robots.txt`.
5. **Crawler visits don't count as the "actual page view" in ADR-0013.** `layout.tsx` skips `scheduleBackgroundReanalysisIfStale` when `isCrawlerUserAgent` (`src/lib/is-crawler-user-agent.ts`) matches the request. That function checks Next's own `userAgentFromString(...).isBot`, plus a generic `bot`/`crawler`/`spider` pattern, and it also treats a missing `User-Agent` as a crawler. This is best effort: a crawler disguised as a browser still triggers at most one rate-limited attempt, exactly as a human visit would. ADR-0013's per-repository claim and staleness gate are unchanged, so this narrows ADR-0013's trigger further and never widens it.
6. **No new infrastructure or dependencies.** Everything uses Next's file-based metadata routes (`sitemap.ts`, `robots.ts`, `opengraph-image.tsx` via `next/og`) and the existing Postgres tables.

## Rationale

The rule is deliberately strict. A thin or misleading page in search results costs more than a missing one: it damages the "justified confidence" the mission promises the first time someone lands from a search. Starting strict is also reversible. Relaxing the rule later (for example, to include `partial` runs) is a one-line change, and so is removing indexing entirely: `buildLoreMetadata` already defaults to `noindex`.

Excluding crawlers from the pull trigger keeps ADR-0013's load-bearing distinction intact: if nobody visits a stale repository, nothing runs. If crawler fetches counted, "a visitor" would effectively become "a search engine's schedule".

## Alternatives considered

- **Index every Lore route.** Rejected. Six-plus pages per repository with overlapping content dilute ranking, and most subviews are thin outside the Overview's context.
- **Keep everything `noindex` and rely on links and launch posts.** Rejected. It gives up the largest no-cost acquisition channel in the marketing plan.
- **Block crawlers from `/lore/` in `robots.txt` except for an allowlist.** Rejected. A blocked page can't be crawled at all, so its `noindex` tag is never read either. Deciding per page through the `robots` meta tag is the mechanism search engines honor.

## Consequences

- `src/lib/lore-indexability.ts` (new): `isIndexableLore` and `indexabilityFactsFromRun`.
- `src/lib/route-metadata.ts`: `buildLoreMetadata` gains `indexable`. Generic Open Graph images are omitted when it's set, so the route's file-based card is used instead.
- `src/app/lore/[owner]/[repo]/page.tsx`: the Overview's `generateMetadata` passes `indexable`.
- `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/lore/[owner]/[repo]/opengraph-image.tsx` (new).
- `src/db/analysis-runs.ts`: `listLatestRunIndexabilityFacts`.
- `src/lib/is-crawler-user-agent.ts` (new). `src/app/lore/[owner]/[repo]/layout.tsx` gates the ADR-0013 trigger on it.
- ADR-0013, `docs/product/non-goals.md`, `CLAUDE.md`, and `.claude/agents/product-scope-guardian.md` are amended to say that the page view must come from a person, not a crawler.
- `docs/architecture/ux-seo-a11y-remediation-plan.md`'s blanket `noindex` note is superseded for the Overview.
- Covered by `src/lib/__tests__/lore-indexability.spec.ts`, `is-crawler-user-agent.spec.ts`, `route-metadata.spec.ts`, and `e2e/marketing.spec.ts`.

## Log

- 2026-10-17: Adopted after a `product-scope-guardian` review recommending indexable Lore pages, accepted by the product owner. Implemented on `feat/marketing-updates` alongside the rest of `docs/MARKETING.md` items 2–3, 5–6, and 9.
