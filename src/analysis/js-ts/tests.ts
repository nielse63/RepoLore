/**
 * Test-to-implementation relationships: prefer a test file's own relative
 * import of its subject (detected); fall back to filename convention
 * (`foo.test.ts` / `foo.spec.ts` -> `foo.ts`) when no such import exists
 * (inferred).
 *
 * A file also counts as a test file when it lives under a top-level `test/`,
 * `tests/`, or `e2e/` directory (mocha/tape/ava-style layouts, e.g.
 * `test/foo.js`, as opposed to Jest's `foo.test.js` co-located convention;
 * `e2e/` is Playwright/Cypress's own convention). `test`/`tests` was
 * validated against a real repository (`sindresorhus/globby`) in
 * implementation session 6, where every test lived under `tests/` with no
 * matching filename suffix. `e2e` was added after this repo's own analysis
 * of itself surfaced a false test relationship: `e2e/home.spec.ts` imports
 * `e2e/coverage.ts` (a Playwright fixture wrapper adding coverage
 * collection, not implementation code — see that file), and without `e2e`
 * recognized as a test root, `coverage.ts` fell through to the
 * "implementation file" bucket and got reported as something `home.spec.ts`
 * tests. Deliberately not extended to `findDirectoryMirrorMatch` below:
 * unlike `test/<path>` → `lib/<path>` unit-test layouts, an e2e spec
 * exercises a page or user flow end-to-end, not one implementation file
 * mirrored by path.
 *
 * A test file's relative imports are filtered against the package's
 * declared entry point (`package.json` main/module/exports): when the only
 * resolved import is that entry point, it's demoted below a directory-path
 * mirror match (`test/<path>` -> `lib/<path>` or `src/<path>`, same
 * filename) before falling back to it. Found validating against a real
 * repository (`sindresorhus/execa`), where every test imports the package's
 * public API (`../../index.js`) as boilerplate — without the demotion, 214
 * of 215 test relationships resolved to that single entry file instead of
 * the directories they actually exercise (e.g. `test/arguments/cwd.js`
 * exercises `lib/arguments/cwd.js`, not `index.js`).
 */

import path from "node:path";
import type { SourceFile } from "ts-morph";
import type { Gap, TestRelationship } from "@/lore/model";
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
} from "./module-resolution";

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

export function isTestFile(relativeFilePath: string): boolean {
  const segments = relativeFilePath.split("/");
  return (
    TEST_FILE_PATTERN.test(relativeFilePath) ||
    segments.includes("__tests__") ||
    segments[0] === "test" ||
    segments[0] === "tests" ||
    segments[0] === "e2e"
  );
}

/**
 * An e2e spec exercises a running page/flow rather than importing one
 * module, so it has no single-file subject the way a unit test does —
 * distinguished so the unmatched-subject gap below can say that plainly
 * instead of implying the analyzer merely failed to find one.
 */
function isE2eRootFile(relativeFilePath: string): boolean {
  return relativeFilePath.split("/")[0] === "e2e";
}

export interface TestExtractionResult {
  testRelationships: TestRelationship[];
  gaps: Gap[];
}

/**
 * Test-root-mirroring convention: `test/<rest>` or `tests/<rest>` maps to an
 * implementation file at `lib/<rest>`, `src/<rest>`, or bare `<rest>` (same
 * filename, no suffix stripping) — the layout used by directory-style test
 * suites (mocha/ava/tape) that group tests by subject directory rather than
 * co-locating a per-file `foo.test.js`.
 */
function findDirectoryMirrorMatch(
  testPath: string,
  implementationFiles: SourceFile[],
  rootDir: string
): SourceFile | undefined {
  const segments = testPath.split("/");
  if (segments[0] !== "test" && segments[0] !== "tests") return undefined;
  const rest = segments.slice(1).join("/");

  const candidatePaths = [`lib/${rest}`, `src/${rest}`, rest];
  return implementationFiles.find((sf) =>
    candidatePaths.includes(toRelative(rootDir, sf.getFilePath()))
  );
}

export function extractTestRelationships(
  sourceFiles: SourceFile[],
  rootDir: string,
  packageEntryPointFilePaths: ReadonlySet<string> = new Set()
): TestExtractionResult {
  const resolver = buildModuleResolutionIndex(sourceFiles);
  const testRelationships: TestRelationship[] = [];
  const gaps: Gap[] = [];

  const testFiles = sourceFiles.filter((sf) =>
    isTestFile(toRelative(rootDir, sf.getFilePath()))
  );
  const implementationFiles = sourceFiles.filter(
    (sf) => !isTestFile(toRelative(rootDir, sf.getFilePath()))
  );

  for (const testFile of testFiles) {
    const testPath = toRelative(rootDir, testFile.getFilePath());
    const testLocation = { filePath: testPath };

    const resolvedImplementationImports = testFile
      .getImportDeclarations()
      .map((importDecl) => importDecl.getModuleSpecifierValue())
      .filter(isRelativeSpecifier)
      .map((specifier) => resolver.resolve(testFile.getFilePath(), specifier))
      .filter(
        (resolved): resolved is SourceFile =>
          !!resolved && !isTestFile(toRelative(rootDir, resolved.getFilePath()))
      );

    const pushImportMatch = (importedImplementation: SourceFile) => {
      const implementationPath = toRelative(
        rootDir,
        importedImplementation.getFilePath()
      );
      testRelationships.push({
        id: `js-ts-test-${testPath}`,
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
    };

    // A non-entry-point relative import is the strongest signal: the test
    // is importing something specific to it, not just the public API.
    const nonEntryImport = resolvedImplementationImports.find(
      (resolved) =>
        !packageEntryPointFilePaths.has(
          toRelative(rootDir, resolved.getFilePath())
        )
    );
    if (nonEntryImport) {
      pushImportMatch(nonEntryImport);
      continue;
    }

    // The only resolved import (if any) is the package's declared entry
    // point — nearly every test in a public-API-style suite imports it, so
    // it's too generic to trust on its own. Prefer a directory-mirror match
    // first (e.g. `test/arguments/cwd.js` -> `lib/arguments/cwd.js`).
    const directoryMirrorMatch = findDirectoryMirrorMatch(
      testPath,
      implementationFiles,
      rootDir
    );
    if (directoryMirrorMatch) {
      const implementationPath = toRelative(
        rootDir,
        directoryMirrorMatch.getFilePath()
      );
      testRelationships.push({
        id: `js-ts-test-${testPath}`,
        testLocation,
        implementationLocation: { filePath: implementationPath },
        certainty: "inferred",
        evidence: [
          {
            kind: "test-directory-mirror-convention",
            certainty: "inferred",
            location: testLocation,
            description: `Test file '${testPath}' mirrors the path of implementation file '${implementationPath}' under a conventional test root.`,
          },
        ],
      });
      continue;
    }

    if (resolvedImplementationImports[0]) {
      pushImportMatch(resolvedImplementationImports[0]);
      continue;
    }

    const testBaseName = path.basename(testPath).replace(TEST_FILE_PATTERN, "");
    const conventionMatch = implementationFiles.find(
      (sf) =>
        path.basename(sf.getFilePath()).replace(/\.(ts|tsx|js|jsx)$/, "") ===
        testBaseName
    );

    if (conventionMatch) {
      const implementationPath = toRelative(
        rootDir,
        conventionMatch.getFilePath()
      );
      testRelationships.push({
        id: `js-ts-test-${testPath}`,
        testLocation,
        implementationLocation: { filePath: implementationPath },
        certainty: "inferred",
        evidence: [
          {
            kind: "test-filename-convention",
            certainty: "inferred",
            location: testLocation,
            description: `Test file '${testPath}' matches the naming convention for '${implementationPath}'.`,
          },
        ],
      });
      continue;
    }

    gaps.push({
      certainty: "unknown",
      description: isE2eRootFile(testPath)
        ? `No relative import or naming convention identifies a single implementation file for '${testPath}' — expected for a page/flow-level e2e spec, which doesn't test one importable module the way a unit test does.`
        : `Could not determine which implementation file '${testPath}' tests.`,
      location: testLocation,
    });
  }

  return { testRelationships, gaps };
}
