/**
 * Derives the reading-path views (`docs/MODEL_OUTPUT.md`, "Start Here" and
 * "Major Areas") from JS/TS extraction output (`./extract-project`).
 *
 * This is a thin JS/TS-specific wrapper around the language-neutral core
 * (`../shared/derive-views.ts`, generalized in session 13 out of what was
 * originally this file in full): it supplies JS/TS's own `isTestFile`, a
 * JS/TS-only tooling-config-filename allowlist, and a
 * `detectSpecialAreaResponsibility` hook labeling areas made up entirely of
 * confidently-detected React components — the only genuinely JS/TS-specific
 * piece of the original derivation logic. Everything else (area grouping,
 * Start Here assembly) lives in the shared core and is reused by Python's
 * `../python/derive-views.ts` unchanged.
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
import type { DetectedReactComponent } from "./react-components";
import { isTestFile } from "./tests";

export interface JsTsViewsInput {
  projectId: string;
  sourceFilePaths: string[];
  relationships: Relationship[];
  entryPoints: EntryPoint[];
  publicContracts: PublicContract[];
  testRelationships: TestRelationship[];
  reactComponents: DetectedReactComponent[];
  gaps: Gap[];
}

export interface JsTsViews {
  structuralAreas: StructuralArea[];
  startHere: Recommendation[];
}

/**
 * Root-level build/test-tool configuration files (e.g. `jest.config.js`) —
 * a narrow, known-tool allowlist rather than a generic `*.config.*` pattern,
 * since the latter would also match a repository's own application config
 * modules (e.g. `src/platform.config.ts`, real, actively-imported source
 * found in `pieces-app/example-typescript` in implementation session 6,
 * which a generic pattern would have wrongly hidden from Start Here).
 */
const TOOLING_CONFIG_FILE_PATTERN =
  /^(jest|webpack|babel|vite|vitest|rollup|next|tailwind|postcss|eslint|commitlint|cypress|playwright|karma|rspack|parcel|esbuild|tsup|turbo|metro)\.(config|setup)\.(js|cjs|mjs|ts|cts|mts)$/;

function isToolingConfigFile(relativeFilePath: string): boolean {
  return (
    !relativeFilePath.includes("/") &&
    TOOLING_CONFIG_FILE_PATTERN.test(relativeFilePath)
  );
}

export function deriveJsTsViews(input: JsTsViewsInput): JsTsViews {
  const { reactComponents, ...rest } = input;
  const reactComponentFiles = new Set(
    reactComponents.map((c) => c.location.filePath)
  );

  return deriveViews(rest, {
    isTestFile,
    isToolingConfigFile,
    detectSpecialAreaResponsibility: (files, areaName) => {
      if (!files.every((f) => reactComponentFiles.has(f))) return undefined;
      return {
        responsibility: "Presentational React components",
        evidence: {
          kind: "react-component-detection",
          certainty: "detected",
          description: `Every source file under '${areaName}' is a confidently-detected React component.`,
        },
      };
    },
  });
}
