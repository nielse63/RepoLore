import path from 'node:path';
import { notFound } from 'next/navigation';
import { deriveJsTsViews } from '@/analysis/js-ts/derive-views';
import { extractJsTsProject } from '@/analysis/js-ts/extract-project';
import { JS_TS_ANALYZER_VERSION } from '@/analysis/js-ts/version';
import { LoreView } from '@/components/LoreView';
import { buildJsTsLore } from '@/lore/build-lore';

/**
 * Plain, unstyled proof-of-concept page rendering a full `Lore` (via the
 * shared `LoreView`) against a local JS/TS fixture — no real GitHub commit,
 * so `sourceUrl` is omitted and locations render as plain text. Exists to
 * prove or disprove the core "wow moment" before any styling — see
 * implementation-plan.md session 5. Only the two JS/TS fixtures built so far
 * are wired up; Python and mixed-language fixtures are later sessions.
 */
const FIXTURE_NAMES = ['ts-react-app', 'ts-library'] as const;
type FixtureName = (typeof FIXTURE_NAMES)[number];

function isFixtureName(value: string): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value);
}

export function generateStaticParams() {
  return FIXTURE_NAMES.map((name) => ({ name }));
}

export default async function FixturePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  if (!isFixtureName(name)) notFound();

  const fixtureRoot = path.join(process.cwd(), 'fixtures', name);
  const extraction = extractJsTsProject(fixtureRoot);
  const views = deriveJsTsViews({
    projectId: extraction.project.id,
    ...extraction,
  });

  const lore = buildJsTsLore({
    owner: 'fixtures',
    repo: name,
    defaultBranch: 'local',
    commitSha: 'local',
    analyzerVersion: JS_TS_ANALYZER_VERSION,
    analyzedAt: new Date().toISOString(),
    extraction,
    views,
  });

  return <LoreView lore={lore} />;
}
