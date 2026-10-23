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
import { TEST_SUPPORT_DIRECTORY_NAMES } from "./test-support-directories";

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
 * Above this many files, the directory-grouping fallback subdivides a
 * bucket one directory level deeper rather than leaving it as one area —
 * see `groupFilesIntoAreaNames` below. Found by validating against
 * `pieces-app/example-typescript`, where the default two-segment grouping
 * (below) collapsed 18 of ~21 source files nested under `src/app/**` into
 * one area indistinguishable in size from a two-file `src`, leaving almost
 * every relationship intra-area and the diagram showing only one real edge.
 */
const MAX_FALLBACK_AREA_FILES = 10;

/**
 * Directory names conventionally holding a test suite — the union of each
 * language's own `isTestFile` directory conventions (JS/TS: `test`, `tests`,
 * `__tests__`, `e2e`; Python: `test`, `tests`), but recognized here at any
 * depth, not only at the project root. Found validating against a real
 * repository (`sveltejs/svelte`, GitHub issue #50): its
 * `packages/svelte/tests/<suite>/samples/<case>/` layout held ~2,900
 * one-or-two-file sample cases, and since none matched either `isTestFile`
 * convention, subdividing split every case into its own area — 2,994 "major
 * areas", none labeled as tests. Area grouping only: each language's
 * `isTestFile` (and so test-relationship extraction) is unchanged, since
 * treating thousands of sample inputs as tests would report each one as a
 * test with no identifiable subject. Extraction instead uses
 * `isUnderUncontradictedTestRoot` below only to *remove* candidates — never
 * to add tests — so a nested harness isn't a bootstrap entry point and a
 * nested helper isn't a test's subject (GitHub issue #65).
 */
const TEST_ROOT_DIRECTORY_NAMES = new Set([
  "test",
  "tests",
  "__tests__",
  "e2e",
]);

/** Index of a file's first directory segment that's a test root, or -1. */
function testRootSegmentIndex(filePath: string): number {
  return filePath
    .split("/")
    .slice(0, -1)
    .findIndex((segment) => TEST_ROOT_DIRECTORY_NAMES.has(segment));
}

export function isUnderTestRoot(filePath: string): boolean {
  return testRootSegmentIndex(filePath) !== -1;
}

/** A file's directory path up to and including its first test root, e.g. "packages/x/tests". */
export function testRootPath(filePath: string): string {
  return filePath
    .split("/")
    .slice(0, testRootSegmentIndex(filePath) + 1)
    .join("/");
}

/**
 * Test roots whose directory name is contradicted by detected structure, so
 * their files aren't labeled tests by name alone: a non-test entry point
 * inside one (e.g. a Next.js `app/test/page.tsx` route), or an import of one
 * of its files from production code outside any test root (e.g. Django's
 * shipped `django/test/` package, imported by `django/core`). Maps each such
 * root path to the first contradiction found, cited as area evidence.
 * Doesn't affect grouping — the root stays one area either way.
 */
export function findContradictedTestRoots(
  input: Pick<DeriveViewsInput, "entryPoints" | "relationships">,
  isTestFile: DeriveViewsConfig["isTestFile"]
): Map<string, string> {
  const contradictions = new Map<string, string>();
  for (const ep of input.entryPoints) {
    const filePath = ep.location.filePath;
    if (ep.kind === "test" || !isUnderTestRoot(filePath)) continue;
    const root = testRootPath(filePath);
    if (!contradictions.has(root)) {
      contradictions.set(
        root,
        `'${filePath}' is detected as a ${describeEntryKind(ep.kind).toLowerCase()}`
      );
    }
  }
  for (const rel of input.relationships) {
    if (!isUnderTestRoot(rel.toId)) continue;
    if (isUnderTestRoot(rel.fromId) || isTestFile(rel.fromId)) continue;
    const root = testRootPath(rel.toId);
    if (!contradictions.has(root)) {
      contradictions.set(
        root,
        `'${rel.fromId}', outside any test directory, depends on '${rel.toId}'`
      );
    }
  }
  return contradictions;
}

/**
 * Predicate for "under a test root its name isn't contradicted by detected
 * structure" (see `findContradictedTestRoots`) — the rule area grouping
 * uses to label a nested test directory "Tests", shared with each
 * language's extraction so a file's area and its own classification agree.
 */
export function isUnderUncontradictedTestRoot(
  input: Pick<DeriveViewsInput, "entryPoints" | "relationships">,
  isTestFile: DeriveViewsConfig["isTestFile"]
): (filePath: string) => boolean {
  const contradictedTestRoots = findContradictedTestRoots(input, isTestFile);
  return (filePath) =>
    isUnderTestRoot(filePath) &&
    !contradictedTestRoots.has(testRootPath(filePath));
}

/**
 * Groups a file into an area at most `depth` directory levels under the
 * project root, e.g. at depth 2, "src/components/Header.tsx" ->
 * "src/components", "src/index.ts" -> "src". A file with no directory (at
 * the project root) always falls into ".", regardless of depth. A file under
 * a test root never goes deeper than that root (e.g. "tests/unit/a.ts" ->
 * "tests"), so a test suite stays one area however it's subdivided.
 */
function areaNameAtDepth(
  filePath: string,
  depth: number,
  capAtTestRoot = true
): string {
  const directorySegments = filePath.split("/").slice(0, -1);
  if (directorySegments.length === 0) return ".";
  const testRootIndex = capAtTestRoot ? testRootSegmentIndex(filePath) : -1;
  const maxDepth =
    testRootIndex === -1 ? depth : Math.min(depth, testRootIndex + 1);
  return directorySegments.slice(0, maxDepth).join("/");
}

/**
 * The directory-grouping fallback (last preference in `docs/MODEL_OUTPUT.md`
 * "Major Areas" boundary detection): starts every file at a two-segment
 * area name, then recursively subdivides any bucket over
 * `MAX_FALLBACK_AREA_FILES` one directory level deeper, so a large flat
 * subtree splits into its real subdirectories instead of collapsing into
 * one oversized, illegible area. A bucket whose files all still share the
 * same directory one level deeper (a genuinely flat directory) stops
 * subdividing there even if it stays over the threshold — there's nothing
 * left to split by. Likewise a test root (`TEST_ROOT_DIRECTORY_NAMES`) is
 * never split further: its subdirectories are test cases, not structure.
 */
function groupFilesIntoAreaNames(
  filePaths: string[],
  maxFilesPerArea: number,
  capAtTestRoot = true
): Map<string, string> {
  const areaNameByFile = new Map<string, string>();

  function assign(files: string[], depth: number) {
    const byName = new Map<string, string[]>();
    for (const filePath of files) {
      const name = areaNameAtDepth(filePath, depth, capAtTestRoot);
      const bucket = byName.get(name) ?? [];
      bucket.push(filePath);
      byName.set(name, bucket);
    }
    for (const [name, bucketFiles] of byName) {
      const canSubdivideFurther =
        bucketFiles.length > maxFilesPerArea &&
        bucketFiles.some(
          (f) => areaNameAtDepth(f, depth + 1, capAtTestRoot) !== name
        );
      if (canSubdivideFurther) {
        assign(bucketFiles, depth + 1);
      } else {
        for (const filePath of bucketFiles) areaNameByFile.set(filePath, name);
      }
    }
  }

  assign(filePaths, 2);
  return areaNameByFile;
}

/**
 * Whether naming this area at its test root actually kept together files
 * that subdividing would otherwise have split into several areas, so the
 * rationale only says so when it's true.
 */
function wasKeptTogetherAsTestRoot(name: string, files: string[]): boolean {
  if (!TEST_ROOT_DIRECTORY_NAMES.has(name.split("/").pop() ?? "")) {
    return false;
  }
  const uncapped = groupFilesIntoAreaNames(
    files,
    MAX_FALLBACK_AREA_FILES,
    false
  );
  return new Set(uncapped.values()).size > 1;
}

/**
 * Namespaced by `projectId` (not just `area:${name}`) so that merging two
 * extractions' derived views into one `Lore` (ADR-0007 — e.g. a JS/TS
 * extraction and a Python extraction both grouping a top-level `src/` into
 * an area) can't collide on the same area ID.
 */
function areaId(projectId: string, name: string): string {
  return `area:${projectId}:${name}`;
}

/**
 * Defense-in-depth only: each language's source discovery already excludes
 * `TEST_SUPPORT_DIRECTORY_NAMES` at any depth, so in practice no such file
 * reaches this module. Kept in case a future caller feeds in file lists that
 * skip discovery's exclusion (e.g. a language extractor added later that
 * doesn't reuse the shared discovery pattern).
 */
function isTestSupportFile(relativeFilePath: string): boolean {
  return relativeFilePath
    .split("/")
    .some((segment) => TEST_SUPPORT_DIRECTORY_NAMES.has(segment));
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
    case "route":
      return "Next.js route entry point";
    case "http-handler":
      return "HTTP route handler entry point";
    case "server-action":
      return "Server Action entry point";
    case "middleware":
      return "Middleware entry point";
    case "ui-event":
      return "UI event entry point";
  }
}

function buildStructuralAreas(
  input: DeriveViewsInput,
  config: DeriveViewsConfig,
  areaNameByFile: Map<string, string>
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

  const contradictedTestRoots = findContradictedTestRoots(input, isTestFile);
  const isUnderUncontradictedTestRootFile = isUnderUncontradictedTestRoot(
    input,
    isTestFile
  );

  const filesByAreaName = new Map<string, string[]>();
  for (const filePath of sourceFilePaths) {
    const name = areaNameByFile.get(filePath) ?? areaNameAtDepth(filePath, 2);
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
      const isAllTestFiles = files.every(
        (f) => isTestFile(f) || isUnderUncontradictedTestRootFile(f)
      );
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
        // Files under a nested test root that the language's own
        // `isTestFile` doesn't match are grouped as tests by directory name
        // alone, not recognized as test files — said so rather than implied.
        const directoryOnlyFiles = files.filter((f) => !isTestFile(f));
        const testRootPaths = [
          ...new Set(directoryOnlyFiles.map(testRootPath)),
        ];
        evidence.push({
          kind: "test-directory-convention",
          certainty: "inferred",
          location: { filePath: name },
          description:
            directoryOnlyFiles.length === 0
              ? `Every source file under '${name}' is recognized as a test file (naming convention or top-level 'test'/'tests' directory).`
              : `${files.length - directoryOnlyFiles.length} source file(s) under '${name}' are recognized as test files; the other ${directoryOnlyFiles.length} lie under a conventional test directory (${testRootPaths.map((p) => `'${p}'`).join(", ")}) and are grouped as tests by directory name only, not recognized as individual test files.`,
        });
      }
      const areaContradictedTestRoots = [
        ...new Set(
          files
            .filter((f) => !isTestFile(f) && isUnderTestRoot(f))
            .map(testRootPath)
            .filter((root) => contradictedTestRoots.has(root))
        ),
      ];
      for (const root of areaContradictedTestRoots) {
        evidence.push({
          kind: "test-directory-name-contradicted",
          certainty: "detected",
          location: { filePath: root },
          description: `'${root}' is named like a test directory, but ${contradictedTestRoots.get(root)}, so its files aren't treated as tests by directory name.`,
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
        id: areaId(projectId, name),
        projectId,
        name,
        location: { filePath: name },
        rationale: `Groups ${files.length} source file(s) under '${name}'; no declared workspace, package, or source-root boundary was found, so files are grouped by directory.${
          wasKeptTogetherAsTestRoot(name, files)
            ? " As a conventional test directory, its subdirectories are kept together as one area rather than split into separate ones."
            : ""
        }`,
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
        productionFilePaths: files.filter(
          (f) => !isTestFile(f) && !isUnderUncontradictedTestRootFile(f)
        ),
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
  structuralAreas: StructuralArea[],
  areaNameByFile: Map<string, string>
): Recommendation[] {
  const { sourceFilePaths, relationships, entryPoints, testRelationships } =
    input;

  const fileCountByAreaName = new Map<string, number>();
  for (const filePath of sourceFilePaths) {
    const name = areaNameByFile.get(filePath) ?? areaNameAtDepth(filePath, 2);
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
    representedAreas.add(
      areaNameByFile.get(item.location.filePath) ??
        areaNameAtDepth(item.location.filePath, 2)
    );
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
  // requirement (`START_HERE_MIN_ITEMS`/`START_HERE_MAX_ITEMS`, ~3–7 items)
  // before steps 2–4 ever run.
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
  const areaNameByFile = groupFilesIntoAreaNames(
    input.sourceFilePaths,
    MAX_FALLBACK_AREA_FILES
  );
  const structuralAreas = buildStructuralAreas(input, config, areaNameByFile);
  const startHere = buildStartHere(input, structuralAreas, areaNameByFile);
  return { structuralAreas, startHere };
}
