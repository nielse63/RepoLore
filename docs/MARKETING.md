# Marketing: Bringing Traffic to Repo Lore

Your biggest asset is that every Lore lives at a public, stable URL (`https://repolore.app/lore/{owner}/{repo}`). For a product like this, those pages are the traffic engine. Right now the code works against that in a few places.

## Fix what's suppressing traffic today (cheap, in-repo)

1. **Lore pages are `noindex`. Done (ADR-0017):** a qualifying Overview is now `index, follow` (`isIndexableLore`: completed, public, at least one entry point and area); subviews and failed, partial, or empty runs stay `noindex`. Crawler visits don't pull-trigger ADR-0013 re-analysis. Originally: Every repository route sets `robots: noindex, follow`, so search engines won't list any Lore. The only page that can be found through search is the home page. People already search for things like "how is X structured" and "X codebase architecture". Making good Lores indexable is the highest-leverage change available. Only allow indexing for pages that are worth it, such as a successful analysis with real content, and keep failed or empty runs `noindex` so they don't show up as thin pages.
2. **There's no `sitemap.ts` or `robots.ts`. Done:** `src/app/sitemap.ts` (indexable Overviews only) and `src/app/robots.ts`. Originally: Next.js can generate both from the `repos` table in roughly 30 lines.
3. **There are no Open Graph images. Done:** `src/app/lore/[owner]/[repo]/opengraph-image.tsx`. Originally: Links to a Lore on Slack, X, or HN show up without a preview image. An `opengraph-image.tsx` per repository could render the repo name plus "N entry points · M areas". Links with images get clicked much more.
4. **Hosting and domain: done.** The app runs on Render's Pro plan, which removes the free tier's 30–60s cold start after 15 minutes idle, so launch traffic no longer lands on a sleeping service. It's served at the custom domain [https://repolore.app](https://repolore.app). Make sure `NEXT_PUBLIC_SITE_URL=https://repolore.app` is set in Render so canonicals and Open Graph URLs use it rather than the `onrender.com` URL. Use `repolore.app` in every sitemap, badge, and launch link (items 2, 6, 7), so rankings and backlinks build up on the domain you'll keep.

## Seed and distribute (no new infrastructure)

5. **Pre-analyze 50–200 popular TS/JS/Python repos.** Tooling done: `npm run seed` with `scripts/seed-repos.txt` (about 55 repos). Still to do: run it against production. (Next.js, FastAPI, Vite, shadcn, etc.) so there are pages for search engines to index and links to share. Pull-triggered refresh (ADR-0013) keeps them current whenever someone visits.
6. **Add a "Lore" README badge. Done:** `public/badge.svg` plus a copyable snippet on the Overview's Analysis rail. that links to `/lore/{owner}/{repo}`. Each maintainer who adds one creates a permanent link back to the site. This is the classic growth loop for dev tools (Codecov, shields.io).
7. **Launch posts:** Show HN, r/programming, r/Python, r/typescript, and dev.to. Pitch it around orientation and onboarding ("understand an unfamiliar repo in 15 minutes"), with a live Lore of a well-known repo as the demo.
8. **Comment usefully** in "how do I navigate this codebase?" discussions and in onboarding threads for open-source contributors, linking the relevant Lore.

## Measure

9. **Partly done:** `submit_repo` and `submit_repo_error` custom events; per-Lore page views and outbound GitHub clicks come from GA4 enhanced measurement. Not yet tracked: whether a submission's run ended `completed`, `partial`, or `failed` (the server redirects before the client sees the result). Add events for submit, analysis success/failure, page views per Lore, and outbound GitHub link clicks, so you can see which channels lead to submissions.

## Deliberately skipped

Paid ads, a blog or content machine, and a GitHub App or webhooks. The ads and content treadmill don't fit the 5–8 hrs/week budget, and webhooks conflict with the non-goal of no headless refresh (`docs/product/non-goals.md`).

## Next steps

Indexing was reviewed by `product-scope-guardian`, which recommended it; recorded in ADR-0017 (2026-10-17). The in-repo items (1–3, 5–6, 9) are implemented. What's left is operational: seed production (`npm run seed` against Neon), confirm GA4 enhanced measurement is on, submit `https://repolore.app/sitemap.xml` in Google Search Console, then do the launch and distribution items (7–8).
