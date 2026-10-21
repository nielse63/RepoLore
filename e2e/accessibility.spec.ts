import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./coverage";

/**
 * Automated accessibility coverage: an axe-core scan of every public page
 * against WCAG 2.0/2.1/2.2 Level A and AA rules, once per color scheme since
 * `globals.css` has a `prefers-color-scheme: dark` palette (contrast differs
 * between them). Automated rules catch only a subset of WCAG failures —
 * keyboard flows and screen-reader wording still need manual review.
 *
 * The Lore pages read the already-persisted `completed` run for the pinned
 * fixture `nielse63/repo-lore-ts-react-app-fixture` (needs `DATABASE_URL`,
 * not `GITHUB_TOKEN`), like `systems.spec.ts`; `src` is one of its Major
 * Area slugs there.
 */

const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";

const PAGES = [
  { name: "home", path: "/" },
  { name: "explore", path: "/explore" },
  { name: "manifesto", path: "/manifesto" },
  { name: "not found", path: "/this-page-does-not-exist" },
  {
    name: "not-analyzed Lore",
    path: "/lore/nielse63/repo-lore-a11y-never-analyzed",
  },
  { name: "Lore Overview", path: repoUrl },
  { name: "Lore Architecture", path: `${repoUrl}/architecture` },
  { name: "Lore Dependencies", path: `${repoUrl}/dependencies` },
  { name: "Lore Data Flow", path: `${repoUrl}/data-flow` },
  { name: "Lore History", path: `${repoUrl}/history` },
  { name: "Lore Systems", path: `${repoUrl}/systems` },
  { name: "Lore System detail", path: `${repoUrl}/systems/src` },
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} color scheme`, () => {
    test.use({ colorScheme });

    for (const { name, path } of PAGES) {
      test(`${name} (${path}) has no detectable WCAG A/AA violations`, async ({
        page,
      }) => {
        await page.goto(path);

        const { violations } = await new AxeBuilder({ page })
          .withTags(WCAG_TAGS)
          .analyze();

        // Mapped to the fields that locate a failure, so the assertion
        // diff names each rule and offending selector rather than dumping
        // axe's full result objects.
        expect(
          violations.map(({ id, impact, help, nodes }) => ({
            id,
            impact,
            help,
            targets: nodes.map((node) => node.target.join(" ")),
          }))
        ).toEqual([]);
      });
    }
  });
}
