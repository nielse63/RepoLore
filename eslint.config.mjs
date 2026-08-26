import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jest from "eslint-plugin-jest";
import playwright from "eslint-plugin-playwright";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/__tests__/**/*.[jt]s?(x)", "**/*.spec.[jt]s?(x)"],
    ignores: ["e2e/**"],
    ...jest.configs["flat/recommended"],
  },
  {
    files: ["e2e/**/*.spec.[jt]s?(x)"],
    ...playwright.configs["flat/recommended"],
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "!/bin/*",
    "coverage",
    "playwright-report",
    "test-results",
    ".repomap",
    ".swc",
  ]),
]);

export default eslintConfig;
