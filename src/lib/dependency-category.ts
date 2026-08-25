/**
 * Purely cosmetic categorization of an external dependency's package name
 * (and, for the data-viz category, its registry-sourced description and
 * keywords), used only to pick a decorative icon on the Dependencies page
 * (ADR-0011). Not a model field, not evidence, not a certainty-labeled claim
 * — a small, fixed keyword allowlist per category with a generic fallback,
 * deliberately bounded rather than exhaustive (open-ended package-name
 * pattern matching was rejected during scope review as an unbounded
 * maintenance burden, the same failure mode ADR-0008 rejected for
 * infrastructure detection; the product owner explicitly chose to keep this
 * narrow, closed list anyway).
 */

import type { ExternalDependency } from "@/lore/model";
import {
  AppWindow,
  BookOpenText,
  BroomSparkles,
  ChartScatter,
  CodeXml,
  Database,
  FlaskConical,
  GitFork,
  ListChecks,
  PaintBucket,
  Puzzle,
  Terminal,
  Type,
  type LucideIcon,
} from "lucide-react";

export type DependencyCategory =
  | "testing"
  | "framework"
  | "library"
  | "uiComponent"
  | "database"
  | "types"
  | "devTooling"
  | "vcs"
  | "cli"
  | "compiler"
  | "dataViz"
  | "styling"
  | "other";

const CATEGORY_ICONS: Record<DependencyCategory, LucideIcon> = {
  testing: FlaskConical,
  framework: AppWindow,
  library: BookOpenText,
  uiComponent: Puzzle,
  database: Database,
  types: Type,
  devTooling: BroomSparkles,
  vcs: GitFork,
  cli: Terminal,
  compiler: ListChecks,
  dataViz: ChartScatter,
  styling: PaintBucket,
  other: CodeXml,
};

/**
 * Name prefixes checked before the exact-name lists below — plugins/configs
 * for a specific tool inherit that tool's category (e.g. `eslint-plugin-*`
 * is `devTooling`, same as `eslint` itself; `@types/*` is `types`).
 */
const CATEGORY_PACKAGE_PREFIXES: Partial<Record<DependencyCategory, string[]>> =
  {
    types: ["@types/"],
    devTooling: ["eslint-", "@eslint/", "prettier-", "@prettier/"],
    testing: ["jest", "@jest/", "playwright", "@playwright"],
    styling: [
      "postcss-",
      "@postcss/",
      "stylelint-",
      "@stylelint/",
      "@emotion/",
    ],
  };

/** A "cli" token anywhere in the name (usually a suffix, e.g. `vue-cli`) marks a CLI-only tool. */
const CLI_NAME_PATTERN = /\bcli\b/i;

const CATEGORY_PACKAGE_NAMES: Record<DependencyCategory, Set<string>> = {
  testing: new Set([
    "jest",
    "vitest",
    "mocha",
    "chai",
    "jasmine",
    "@testing-library/react",
    "cypress",
    "playwright",
    "@playwright/test",
    "pytest",
    "pytest-cov",
    "unittest2",
    "nose",
    "tox",
  ]),
  framework: new Set([
    "react",
    "vue",
    "@angular/core",
    "svelte",
    "solid-js",
    "preact",
    "next",
    "express",
    "fastify",
    "koa",
    "nestjs",
    "@nestjs/core",
    "fastapi",
    "flask",
    "django",
    "celery",
    "starlette",
    "uvicorn",
  ]),
  library: new Set([
    "axios",
    "node-fetch",
    "got",
    "superagent",
    "ky",
    "undici",
    "requests",
    "httpx",
    "aiohttp",
    "urllib3",
    "zod",
    "joi",
    "yup",
    "ajv",
    "class-validator",
    "pydantic",
    "cerberus",
    "marshmallow",
    "jsonschema",
  ]),
  uiComponent: new Set([
    "@radix-ui/react-popover",
    "@radix-ui/react-switch",
    "@radix-ui/react-tabs",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-tooltip",
    "@radix-ui/themes",
    "@headlessui/react",
    "@mui/material",
    "@mui/joy",
    "@chakra-ui/react",
    "antd",
    "react-bootstrap",
    "reactstrap",
    "semantic-ui-react",
  ]),
  database: new Set([
    "pg",
    "pg-promise",
    "mysql",
    "mysql2",
    "mongoose",
    "mongodb",
    "sequelize",
    "prisma",
    "@prisma/client",
    "knex",
    "typeorm",
    "redis",
    "ioredis",
    "sqlite3",
    "better-sqlite3",
    "sqlalchemy",
    "psycopg2",
    "psycopg2-binary",
    "pymongo",
    "redis-py",
    "asyncpg",
  ]),
  types: new Set(),
  devTooling: new Set([
    "eslint",
    "prettier",
    "black",
    "ruff",
    "mypy",
    "flake8",
    "pylint",
    "isort",
    "lint-staged",
    "setuptools",
    "poetry",
    "wheel",
    "pip-tools",
  ]),
  vcs: new Set([
    "simple-git",
    "isomorphic-git",
    "nodegit",
    "dugite",
    "husky",
    "gitpython",
    "dulwich",
    "pygit2",
  ]),
  cli: new Set([
    "commander",
    "yargs",
    "cac",
    "meow",
    "inquirer",
    "prompts",
    "click",
    "typer",
    "docopt",
    "fire",
  ]),
  compiler: new Set([
    "webpack",
    "vite",
    "babel",
    "@babel/core",
    "rollup",
    "esbuild",
    "typescript",
    "tsx",
    "ts-node",
    "swc",
    "@swc/core",
    "parcel",
  ]),
  dataViz: new Set([
    "chart.js",
    "react-chartjs-2",
    "recharts",
    "d3",
    "victory",
    "nivo",
    "@nivo/core",
    "echarts",
    "apexcharts",
    "highcharts",
    "plotly.js",
    "vega",
    "vega-lite",
    "@visx/visx",
    "matplotlib",
    "seaborn",
    "plotly",
    "bokeh",
    "altair",
    "pygal",
    "plotnine",
  ]),
  styling: new Set([
    "tailwindcss",
    "@tailwindcss/postcss",
    "@tailwindcss/vite",
    "sass",
    "node-sass",
    "less",
    "postcss",
    "autoprefixer",
    "stylelint",
    "styled-components",
    "emotion",
    "stylis",
    "windicss",
    "unocss",
    "bootstrap",
    "bulma",
    "csso",
    "cssnano",
    "purgecss",
  ]),
  other: new Set(),
};

/**
 * Whole-word terms checked against a dependency's description/keywords when
 * its name doesn't match the exact-name list above — e.g. an unlisted
 * charting package whose npm/PyPI description says "plotting library".
 * Matched on word boundaries so, for example, "graph" doesn't fire on
 * "GraphQL".
 */
const DATA_VIZ_TERMS = [
  "chart",
  "charting",
  "graph",
  "graphing",
  "plot",
  "plotting",
  "visualization",
  "visualisation",
  "dataviz",
];
const DATA_VIZ_TERM_PATTERN = new RegExp(
  `\\b(${DATA_VIZ_TERMS.join("|")})\\b`,
  "i"
);

function hasDataVizSignal(description?: string, keywords?: string[]): boolean {
  const haystacks = [description, ...(keywords ?? [])].filter(
    (s): s is string => !!s && s.trim().length > 0
  );
  return haystacks.some((text) => DATA_VIZ_TERM_PATTERN.test(text));
}

export type DependencyIdentity = Pick<
  ExternalDependency,
  "name" | "description" | "keywords"
>;

export function categorizeDependency(
  dep: DependencyIdentity
): DependencyCategory {
  const lower = dep.name.toLowerCase();
  for (const [category, prefixes] of Object.entries(
    CATEGORY_PACKAGE_PREFIXES
  )) {
    if (prefixes!.some((prefix) => lower.startsWith(prefix))) {
      return category as DependencyCategory;
    }
  }
  if (CLI_NAME_PATTERN.test(lower)) return "cli";
  for (const [category, names] of Object.entries(CATEGORY_PACKAGE_NAMES)) {
    if (category === "other") continue;
    if (names.has(lower)) return category as DependencyCategory;
  }
  if (hasDataVizSignal(dep.description, dep.keywords)) return "dataViz";
  return "other";
}

export function dependencyCategoryIcon(dep: DependencyIdentity): LucideIcon {
  return CATEGORY_ICONS[categorizeDependency(dep)];
}
