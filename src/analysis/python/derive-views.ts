/**
 * Derives the reading-path views (`docs/MODEL_OUTPUT.md`, "Start Here" and
 * "Major Areas") from Python extraction output (`./extract-project`).
 *
 * A thin Python-specific wrapper around the language-neutral core
 * (`../shared/derive-views.ts`, generalized out of JS/TS's original
 * implementation in session 13): supplies Python's own `isTestFile` (pytest
 * `test_*.py`/`*_test.py` convention, already shared with `./tests.ts`'s
 * test-relationship extraction) and a Python tooling-config-filename check.
 * Python has no framework-detection equivalent to JS/TS's React components,
 * so no `detectSpecialAreaResponsibility` hook is supplied.
 */

import type {
  EntryPoint,
  Gap,
  PublicContract,
  Recommendation,
  Relationship,
  StructuralArea,
  TestRelationship,
} from "@/lore/model";
import { deriveViews } from "../shared/derive-views";
import { isTestFile } from "./tests";

export interface PythonViewsInput {
  projectId: string;
  sourceFilePaths: string[];
  relationships: Relationship[];
  entryPoints: EntryPoint[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  gaps: Gap[];
}

export interface PythonViews {
  structuralAreas: StructuralArea[];
  startHere: Recommendation[];
}

/**
 * Root-level packaging/tooling files that are real `.py` source as far as
 * discovery is concerned but aren't implementation code — the direct Python
 * analogue of JS/TS's `jest.config.js`-as-source bug (session 6): `setup.py`
 * declares packaging metadata via a `setup(...)` call, not a module anyone
 * would read to understand the project's behavior.
 */
const PYTHON_TOOLING_CONFIG_FILENAMES = new Set(["setup.py"]);

function isToolingConfigFile(relativeFilePath: string): boolean {
  return (
    !relativeFilePath.includes("/") &&
    PYTHON_TOOLING_CONFIG_FILENAMES.has(relativeFilePath)
  );
}

export function derivePythonViews(input: PythonViewsInput): PythonViews {
  return deriveViews(input, { isTestFile, isToolingConfigFile });
}
