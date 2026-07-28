import path from "node:path";
import { notFound } from "next/navigation";
import { deriveJsTsViews } from "@/analysis/js-ts/derive-views";
import { extractJsTsProject } from "@/analysis/js-ts/extract-project";
import { JS_TS_ANALYZER_VERSION } from "@/analysis/js-ts/version";
import { derivePythonViews } from "@/analysis/python/derive-views";
import { extractPythonProject } from "@/analysis/python/extract-project";
import { PYTHON_ANALYZER_VERSION } from "@/analysis/python/version";
import { LoreView } from "@/components/LoreView";
import { buildLore, type BuildLoreExtraction } from "@/lore/build-lore";
import type { DerivedViews } from "@/analysis/shared/derive-views";

/**
 * Plain, unstyled proof-of-concept page rendering a full `Lore` (via the
 * shared `LoreView`) against a local fixture — no real GitHub commit, so
 * `sourceUrl` is omitted and locations render as plain text. Exists to prove
 * or disprove the core "wow moment" before any styling — see
 * implementation-plan.md session 5 (JS/TS) and session 13 (Python).
 */
const FIXTURE_NAMES = [
  "ts-react-app",
  "ts-library",
  "python-app",
  "python-library",
] as const;
type FixtureName = (typeof FIXTURE_NAMES)[number];

const PYTHON_FIXTURE_NAMES = new Set<FixtureName>([
  "python-app",
  "python-library",
]);

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

  const fixtureRoot = path.join(process.cwd(), "fixtures", name);

  let extraction: BuildLoreExtraction;
  let views: DerivedViews;
  let analyzerVersion: string;

  if (PYTHON_FIXTURE_NAMES.has(name)) {
    const pythonExtraction = await extractPythonProject(fixtureRoot);
    extraction = pythonExtraction;
    views = derivePythonViews({
      projectId: pythonExtraction.project.id,
      ...pythonExtraction,
    });
    analyzerVersion = PYTHON_ANALYZER_VERSION;
  } else {
    const jsTsExtraction = extractJsTsProject(fixtureRoot);
    extraction = jsTsExtraction;
    views = deriveJsTsViews({
      projectId: jsTsExtraction.project.id,
      ...jsTsExtraction,
    });
    analyzerVersion = JS_TS_ANALYZER_VERSION;
  }

  const lore = buildLore({
    owner: "fixtures",
    repo: name,
    defaultBranch: "local",
    commitSha: "local",
    analyzerVersion,
    analyzedAt: new Date().toISOString(),
    extraction,
    views,
  });

  return <LoreView lore={lore} />;
}
