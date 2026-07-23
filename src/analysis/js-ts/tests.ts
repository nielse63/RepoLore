/**
 * Test-to-implementation relationships: prefer a test file's own relative
 * import of its subject (detected); fall back to filename convention
 * (`foo.test.ts` / `foo.spec.ts` -> `foo.ts`) when no such import exists
 * (inferred).
 *
 * A file also counts as a test file when it lives under a top-level `test/`
 * or `tests/` directory (mocha/tape/ava-style layouts, e.g. `test/foo.js`,
 * as opposed to Jest's `foo.test.js` co-located convention) — validated
 * against a real repository (`sindresorhus/globby`) in implementation
 * session 6, where every test lived under `tests/` with no matching
 * filename suffix.
 */

import path from 'node:path';
import type { SourceFile } from 'ts-morph';
import type { Gap, TestRelationship } from '@/lore/model';
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
} from './module-resolution';

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx|js|jsx)$/;

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join('/');
}

export function isTestFile(relativeFilePath: string): boolean {
  const segments = relativeFilePath.split('/');
  return (
    TEST_FILE_PATTERN.test(relativeFilePath) ||
    segments.includes('__tests__') ||
    segments[0] === 'test' ||
    segments[0] === 'tests'
  );
}

export interface TestExtractionResult {
  testRelationships: TestRelationship[];
  gaps: Gap[];
}

export function extractTestRelationships(
  sourceFiles: SourceFile[],
  rootDir: string
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

    const importedImplementation = testFile
      .getImportDeclarations()
      .map((importDecl) => importDecl.getModuleSpecifierValue())
      .filter(isRelativeSpecifier)
      .map((specifier) => resolver.resolve(testFile.getFilePath(), specifier))
      .find(
        (resolved) =>
          resolved && !isTestFile(toRelative(rootDir, resolved.getFilePath()))
      );

    if (importedImplementation) {
      const implementationPath = toRelative(
        rootDir,
        importedImplementation.getFilePath()
      );
      testRelationships.push({
        id: `js-ts-test-${testPath}`,
        testLocation,
        implementationLocation: { filePath: implementationPath },
        certainty: 'detected',
        evidence: [
          {
            kind: 'test-imports-implementation',
            certainty: 'detected',
            location: testLocation,
            description: `Test file '${testPath}' imports '${implementationPath}'.`,
          },
        ],
      });
      continue;
    }

    const testBaseName = path.basename(testPath).replace(TEST_FILE_PATTERN, '');
    const conventionMatch = implementationFiles.find(
      (sf) =>
        path.basename(sf.getFilePath()).replace(/\.(ts|tsx|js|jsx)$/, '') ===
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
        certainty: 'inferred',
        evidence: [
          {
            kind: 'test-filename-convention',
            certainty: 'inferred',
            location: testLocation,
            description: `Test file '${testPath}' matches the naming convention for '${implementationPath}'.`,
          },
        ],
      });
      continue;
    }

    gaps.push({
      certainty: 'unknown',
      description: `Could not determine which implementation file '${testPath}' tests.`,
      location: testLocation,
    });
  }

  return { testRelationships, gaps };
}
