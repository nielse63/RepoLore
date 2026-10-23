/**
 * Test-to-implementation relationships: prefer a test file's own resolved
 * import of an implementation file (detected, reusing `./imports.ts`'s
 * already-resolved dependency targets); fall back to filename convention
 * (`test_foo.py` / `foo_test.py` -> `foo.py`, inferred) when no such import
 * exists.
 *
 * `isTestFile` recognizes both pytest's (`test_*.py`/`*_test.py`) and a
 * conventional top-level `test`/`tests` directory layout — the same
 * recognition covers `unittest.TestCase`-based suites, since those
 * conventionally live in the same locations (both conventional pytest and
 * unittest layouts are in scope).
 *
 * Files under a nested test directory (`isUnderTestDirectory`, e.g.
 * `pkg/tests/helpers.py`) are never an implementation subject, but aren't
 * test files themselves either (GitHub issue #65; see
 * `../shared/derive-views`'s `TEST_ROOT_DIRECTORY_NAMES`).
 */

import path from "node:path";
import type { Gap, TestRelationship } from "@/lore/model";
import type { PythonSourceFile } from "./discovery";

const TEST_FILE_PATTERN = /^(test_.*|.*_test)\.py$/;

export function isTestFile(relativeFilePath: string): boolean {
  const segments = relativeFilePath.split("/");
  const basename = segments[segments.length - 1];
  return (
    TEST_FILE_PATTERN.test(basename) ||
    segments[0] === "test" ||
    segments[0] === "tests"
  );
}

export interface PythonTestExtractionResult {
  testRelationships: TestRelationship[];
  gaps: Gap[];
}

/** Strips the `test_`/`_test` naming convention, or undefined if the filename doesn't use it. */
function conventionalSubjectName(testBasename: string): string | undefined {
  const withoutExt = testBasename.replace(/\.py$/, "");
  if (withoutExt.startsWith("test_")) return withoutExt.slice("test_".length);
  if (withoutExt.endsWith("_test")) return withoutExt.slice(0, -"_test".length);
  return undefined;
}

export function extractTestRelationships(
  sourceFiles: PythonSourceFile[],
  resolvedDependenciesByFile: Map<string, string[]>,
  isUnderTestDirectory: (relativeFilePath: string) => boolean = () => false
): PythonTestExtractionResult {
  const testRelationships: TestRelationship[] = [];
  const gaps: Gap[] = [];
  const isImplementationFile = (relativeFilePath: string) =>
    !isTestFile(relativeFilePath) && !isUnderTestDirectory(relativeFilePath);

  for (const testFile of sourceFiles.filter((sf) =>
    isTestFile(sf.relativePath)
  )) {
    const testPath = testFile.relativePath;
    const testLocation = { filePath: testPath };

    const resolvedImplementationTargets = (
      resolvedDependenciesByFile.get(testPath) ?? []
    ).filter(isImplementationFile);

    if (resolvedImplementationTargets.length > 0) {
      const implementationPath = resolvedImplementationTargets[0];
      testRelationships.push({
        id: `python-test-${testPath}`,
        testLocation,
        implementationLocation: { filePath: implementationPath },
        certainty: "detected",
        evidence: [
          {
            kind: "test-imports-implementation",
            certainty: "detected",
            location: testLocation,
            description: `Test file '${testPath}' imports '${implementationPath}'.`,
          },
        ],
      });
      continue;
    }

    const subjectName = conventionalSubjectName(path.basename(testPath));
    const conventionMatch = subjectName
      ? sourceFiles.find(
          (sf) =>
            isImplementationFile(sf.relativePath) &&
            path.basename(sf.relativePath).replace(/\.py$/, "") === subjectName
        )
      : undefined;

    if (conventionMatch) {
      testRelationships.push({
        id: `python-test-${testPath}`,
        testLocation,
        implementationLocation: { filePath: conventionMatch.relativePath },
        certainty: "inferred",
        evidence: [
          {
            kind: "test-filename-convention",
            certainty: "inferred",
            location: testLocation,
            description: `Test file '${testPath}' matches the naming convention for '${conventionMatch.relativePath}'.`,
          },
        ],
      });
      continue;
    }

    gaps.push({
      certainty: "unknown",
      description: `Could not determine which implementation file '${testPath}' tests.`,
      location: testLocation,
    });
  }

  return { testRelationships, gaps };
}
