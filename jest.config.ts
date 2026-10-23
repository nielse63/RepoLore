import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const reporters: NonNullable<Config["reporters"]> = ["default"];
if (process.env.CI) {
  reporters.push([
    "jest-junit",
    { outputDirectory: "test-results", outputName: "junit.xml" },
  ]);
}

const config: Config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.spec.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  reporters,
  coverageReporters: ["html", "json", "lcov", "text-summary"],
};

export default createJestConfig(config);
