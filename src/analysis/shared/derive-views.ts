/**
 * Language-neutral core of deriving the reading-path views
 * (`docs/MODEL_OUTPUT.md`, "Start Here" and "Major Areas") from any
 * language's extraction output. Originally built for JS/TS
 * (`../js-ts/derive-views.ts`, session 5, validated against real repos in
 * session 6) and generalized here in session 13 so Python (and any future
 * language) reuses the same, already-validated area-grouping and Start Here
 * assembly logic rather than a second parallel implementation.
 *
 * What varies per language is threaded through `DeriveViewsConfig`:
 * `isTestFile`/`isToolingConfigFile` (each language's own filename
 * conventions), and an optional `detectSpecialAreaResponsibility` hook for a
 * language/framework-specific detector (e.g. JS/TS's confidently-detected
 * React components) that labels an area beyond the ordinary fallback. A
 * language with no such detector (Python, for now) simply omits the hook —
 * this file never needs to know what React is.
 *
 * Boundary detection follows the preference order in `docs/MODEL_OUTPUT.md`
 * ("Major Areas"): declared packages/workspaces first, then framework
 * convention, then relationship-supported groupings, then a conservative
 * structural fallback. Start Here follows the five guiding questions in
 * `docs/MODEL_OUTPUT.md` ("Start Here"): seed with what starts the system
 * (or, for a library, its declared public entry point), follow the primary
 * detected dependency chain outward, pad with any major area not yet
 * covered, then close with a representative test when one exists.
 */

import type {
  EntryPoint,
  Evidence,
  Gap,
  PublicContract,
  Recommendation,
  Relationship,
  StructuralArea,
  TestRelationship,
} from "@/lore/model";
import { START_HERE_MAX_ITEMS } from "@/lore/model";

export interface DeriveViewsInput {
  projectId: string;
  sourceFilePaths: string[];
  relationships: Relationship[];
  entryPoints: EntryPoint[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  gaps: Gap[];
}

export interface DeriveViewsConfig {
  isTestFile: (relativeFilePath: string) => boolean;
  isToolingConfigFile: (relativeFilePath: string) => boolean;
  /**
   * Labels an area whose every file matches some other language/framework-
   * specific detection (e.g. JS/TS's confidently-detected React components)
   * with a `responsibility` other than an ordinary implementation area, plus
   * the evidence entry backing that label. Optional — a language with no
   * such detection omits this entirely; no branch runs, no no-op needed.
   */
  detectSpecialAreaResponsibility?: (
    files: string[],
    areaName: string
  ) =>
    | { responsibility: string; evidence: Omit<Evidence, "location"> }
    | undefined;
}

export interface DerivedViews {
  structuralAreas: StructuralArea[];
  startHere: Recommendation[];
}

const STARTING_ENTRY_KINDS: ReadonlyArray<EntryPoint["kind"]> = [
  "bootstrap",
  "cli",
];

/**
 * Area responsibilities that are real (evidence-backed) but not primary
 * implementation — Start Here's area-padding step (step 3) skips these,
 * since "where can behavior be observed" (tests) is step 4's job, and
 * tooling configuration isn't a reading-path destination at all.
 */
const NON_PRIMARY_AREA_RESPONSIBILITIES = new Set([
  "Tests",
  "Test fixtures/support data",
  "Build/tooling configuration",
]);

/**
 * Groups a file into an area one directory level under the project root,
 * e.g. "src/components/Header.tsx" -> "src/components", "src/index.ts" ->
 * "src". A file with no directory (at the project root) falls into ".".
 */
function areaNameForFile(filePath: string): string {
  const directorySegments = filePath.split("/").slice(0, -1);
  if (directorySegments.length === 0) return ".";
  return directorySegments.slice(0, 2).join("/");
}

function areaId(name: string): string {
  return `area:${name}`;
}

/**
 * Top-level directories conventionally holding test *data* rather than test
 * *code* (e.g. fixture inputs spawned or read by a test suite) — distinct
 * from `isTestFile`, since these files rarely look like tests themselves.
 * Validated against a real repository (`sindresorhus/globby`) in
 * implementation session 6, where `fixtures/` files (not under `test/` or
 * `tests/`) still crowded out real implementation areas in Start Here.
 */
const TEST_SUPPORT_DIRECTORY_NAMES = new Set([
  "fixtures",
  "__fixtures__",
  "__mocks__",
]);

function isTestSupportFile(relativeFilePath: string): boolean {
  return TEST_SUPPORT_DIRECTORY_NAMES.has(relativeFilePath.split("/")[0]);
}

function describeEntryKind(kind: EntryPoint["kind"]): string {
  switch (kind) {
    case "bootstrap":
      return "Application bootstrap entry point";
    case "cli":
      return "Command-line entry point";
    case "runtime":
      return "Conventional runtime entry point";
    case "library":
      return "Package's declared public entry point";
    case "public-export":
      return "Public export entry point";
    case "framework":
      return "Framework entry point";
    case "test":
      return "Test entry point";
  }
}

function buildStructuralAreas(
  input: DeriveViewsInput,
  config: DeriveViewsConfig
): StructuralArea[] {
  const {
    projectId,
    sourceFilePaths,
    relationships,
    entryPoints,
    publicContracts,
    testRelationships,
    gaps,
  } = input;
  const { isTestFile, isToolingConfigFile, detectSpecialAreaResponsibility } =
    config;

  const areaNameByFile = new Map<string, string>();
  const filesByAreaName = new Map<string, string[]>();
  for (const filePath of sourceFilePaths) {
    const name = areaNameForFile(filePath);
    areaNameByFile.set(filePath, name);
    const files = filesByAreaName.get(name) ?? [];
    files.push(filePath);
    filesByAreaName.set(name, files);
  }

  const areas: StructuralArea[] = [...filesByAreaName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, unsortedFiles]) => {
      const files = [...unsortedFiles].sort();
      const specialResponsibility = detectSpecialAreaResponsibility?.(
        files,
        name
      );
      const isAllTestFiles = files.every((f) => isTestFile(f));
      const isAllTestSupportFiles =
        !isAllTestFiles && files.every((f) => isTestSupportFile(f));
      const isAllToolingConfig = files.every((f) => isToolingConfigFile(f));

      const areaEntryPoints = entryPoints.filter(
        (ep) => areaNameByFile.get(ep.location.filePath) === name
      );
      const areaContracts = publicContracts.filter(
        (pc) => areaNameByFile.get(pc.location.filePath) === name
      );
      const areaTests = testRelationships.filter(
        (tr) =>
          areaNameByFile.get(tr.testLocation.filePath) === name ||
          areaNameByFile.get(tr.implementationLocation.filePath) === name
      );
      const areaGaps = gaps.filter(
        (g) => g.location && areaNameByFile.get(g.location.filePath) === name
      );

      const evidence: Evidence[] = [
        {
          kind: "source-directory-grouping",
          certainty: "inferred",
          location: { filePath: name },
          description: `${files.length} source file(s) discovered under '${name}', grouped as a conservative structural fallback since no declared workspace, package, or source-root boundary was found.`,
        },
      ];
      if (specialResponsibility) {
        evidence.push({
          ...specialResponsibility.evidence,
          location: { filePath: name },
        });
      }
      if (isAllTestFiles) {
        evidence.push({
          kind: "test-directory-convention",
          certainty: "inferred",
          location: { filePath: name },
          description: `Every source file under '${name}' is recognized as a test file (naming convention or top-level 'test'/'tests' directory).`,
        });
      }
      if (isAllTestSupportFiles) {
        evidence.push({
          kind: "test-support-directory-convention",
          certainty: "inferred",
          location: { filePath: name },
          description: `Every source file under '${name}' lives under a conventional test-fixture/mock directory, not implementation code.`,
        });
      }
      if (isAllToolingConfig) {
        evidence.push({
          kind: "tooling-config-file",
          certainty: "inferred",
          location: { filePath: name },
          description: `Every source file under '${name}' matches a known build/test-tool configuration filename, not implementation code.`,
        });
      }

      const area: StructuralArea = {
        id: areaId(name),
        projectId,
        name,
        location: { filePath: name },
        rationale: `Groups ${files.length} source file(s) under '${name}'; no declared workspace, package, or source-root boundary was found, so files are grouped by directory.`,
        responsibility: specialResponsibility
          ? specialResponsibility.responsibility
          : isAllTestFiles
            ? "Tests"
            : isAllTestSupportFiles
              ? "Test fixtures/support data"
              : isAllToolingConfig
                ? "Build/tooling configuration"
                : undefined,
        importantLocations: [
          ...areaEntryPoints.map((ep) => ep.location),
          ...areaContracts.map((pc) => pc.location),
        ],
        entryPointIds: areaEntryPoints.map((ep) => ep.id),
        directDependencyIds: [],
        directDependentIds: [],
        testRelationshipIds: areaTests.map((tr) => tr.id),
        evidence,
        gaps: areaGaps,
      };
      return area;
    });

  const areaByName = new Map(areas.map((a) => [a.name, a]));
  for (const rel of relationships) {
    const fromArea = areaByName.get(areaNameByFile.get(rel.fromId) ?? "");
    const toArea = areaByName.get(areaNameByFile.get(rel.toId) ?? "");
    if (!fromArea || !toArea || fromArea.id === toArea.id) continue;
    if (!fromArea.directDependencyIds.includes(toArea.id)) {
      fromArea.directDependencyIds.push(toArea.id);
    }
    if (!toArea.directDependentIds.includes(fromArea.id)) {
      toArea.directDependentIds.push(fromArea.id);
    }
  }

  return areas;
}

function buildStartHere(
  input: DeriveViewsInput,
  structuralAreas: StructuralArea[]
): Recommendation[] {
  const { sourceFilePaths, relationships, entryPoints, testRelationships } =
    input;

  const fileCountByAreaName = new Map<string, number>();
  for (const filePath of sourceFilePaths) {
    const name = areaNameForFile(filePath);
    fileCountByAreaName.set(name, (fileCountByAreaName.get(name) ?? 0) + 1);
  }

  const items: Recommendation[] = [];
  const representedFiles = new Set<string>();
  const representedAreas = new Set<string>();
  let order = 0;

  function addItem(item: Omit<Recommendation, "id" | "order">) {
    order += 1;
    items.push({ id: `start-here-${order}`, order, ...item });
    representedFiles.add(item.location.filePath);
    representedAreas.add(areaNameForFile(item.location.filePath));
  }

  const maxItemsBeforeTest =
    START_HERE_MAX_ITEMS - (testRelationships.length > 0 ? 1 : 0);

  // 1. What starts the system? A running application's bootstrap/CLI entry
  // point, or — when there is none — a library's declared public entry point.
  // Capped like every other step: a repository that's a curated collection
  // of many independently-runnable scripts (each with its own legitimate
  // `if __name__ == "__main__":`-style guard — observed validating against
  // a real repository, `TheAlgorithms/Python`, in implementation session
  // 13) can otherwise produce hundreds of simultaneous "bootstrap" entry
  // points, one per script, defeating Start Here's own conciseness
  // requirement (`docs/product/mvp.md`'s ~3–7 items) before steps 2–4 ever
  // run.
  const applicationEntries = entryPoints.filter((ep) =>
    STARTING_ENTRY_KINDS.includes(ep.kind)
  );
  const usingApplicationEntries = applicationEntries.length > 0;
  const seedEntries = usingApplicationEntries
    ? applicationEntries
    : entryPoints.filter(
        (ep) => ep.kind === "library" || ep.kind === "runtime"
      );

  for (const ep of seedEntries) {
    if (items.length >= maxItemsBeforeTest) break;
    addItem({
      location: ep.location,
      whatItRepresents: describeEntryKind(ep.kind),
      rationale: usingApplicationEntries
        ? "This is likely where the system starts executing; begin here to see how it boots."
        : "This is the system's declared public entry point for consumers.",
      certainty: ep.certainty,
      evidence: ep.evidence,
    });
  }

  // 2. Where is the system assembled, and what are its primary internal
  // areas? Follow the detected internal dependency chain outward from the
  // seed entries actually represented above, breadth-first, capped so a
  // large repository doesn't crowd out the later steps.
  const queue = items.map((item) => item.location.filePath);
  while (queue.length > 0 && items.length < maxItemsBeforeTest) {
    const currentFile = queue.shift();
    if (currentFile === undefined) break;
    const outgoing = relationships
      .filter(
        (rel) => rel.fromId === currentFile && !representedFiles.has(rel.toId)
      )
      .sort(
        (a, b) =>
          Number(b.certainty === "detected") -
          Number(a.certainty === "detected")
      );

    for (const rel of outgoing) {
      if (items.length >= maxItemsBeforeTest) break;
      if (representedFiles.has(rel.toId)) continue;
      addItem({
        location: { filePath: rel.toId },
        whatItRepresents: `A module directly depended on by '${currentFile}'`,
        rationale:
          rel.evidence[0]?.description ??
          `'${currentFile}' depends on '${rel.toId}'.`,
        certainty: rel.certainty,
        evidence: rel.evidence,
      });
      queue.push(rel.toId);
    }
  }

  // 3. Pad with any major area not yet represented, largest first, so the
  // path covers the project's primary internal areas rather than only the
  // entry point's own dependency chain. Non-primary areas (tests,
  // test-support data, tooling config) are skipped here — a test or
  // config directory outranking real implementation areas by file count (as
  // seen validating against real repositories in session 6) is exactly the
  // "largest files" failure mode docs/MODEL_OUTPUT.md warns Start Here must
  // avoid.
  const areasByCoverage = [...structuralAreas].sort((a, b) => {
    const diff =
      (fileCountByAreaName.get(b.name) ?? 0) -
      (fileCountByAreaName.get(a.name) ?? 0);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
  for (const area of areasByCoverage) {
    if (items.length >= maxItemsBeforeTest) break;
    if (representedAreas.has(area.name)) continue;
    if (
      area.responsibility &&
      NON_PRIMARY_AREA_RESPONSIBILITIES.has(area.responsibility)
    ) {
      continue;
    }
    addItem({
      location: area.location,
      whatItRepresents: `Primary structural area: '${area.name}'`,
      rationale: area.rationale,
      certainty: "inferred",
      evidence: area.evidence,
    });
  }

  // 4. Where can representative behavior be observed? Close with a test
  // relationship, when one exists, that isn't already represented.
  if (items.length < START_HERE_MAX_ITEMS) {
    const candidate =
      testRelationships.find(
        (tr) => !representedFiles.has(tr.testLocation.filePath)
      ) ?? testRelationships[0];
    if (candidate && !representedFiles.has(candidate.testLocation.filePath)) {
      addItem({
        location: candidate.testLocation,
        whatItRepresents: `Test for '${candidate.implementationLocation.filePath}'`,
        rationale:
          candidate.evidence[0]?.description ??
          "Exercises the implementation directly; a good place to observe representative behavior.",
        certainty: candidate.certainty,
        evidence: candidate.evidence,
      });
    }
  }

  return items;
}

export function deriveViews(
  input: DeriveViewsInput,
  config: DeriveViewsConfig
): DerivedViews {
  const structuralAreas = buildStructuralAreas(input, config);
  const startHere = buildStartHere(input, structuralAreas);
  return { structuralAreas, startHere };
}
