/**
 * Reads path-alias configuration from whichever of tsconfig.json,
 * jsconfig.json, package.json's "imports" field, and common bundler/
 * framework config files (vite/webpack/rsbuild/rollup/nuxt/next/babel) are
 * present (issue #24; ADR-0003's deferred alias-resolution item; ADR-0015).
 *
 * JSON-shaped sources (tsconfig.json, jsconfig.json, package.json) are
 * parsed directly. The remaining sources are JS/TS files whose real
 * configuration is normally only knowable by executing them — executing
 * analyzed-repository code is an explicit product non-goal, so those are
 * instead parsed syntactically via ts-morph, extracting only literal alias
 * patterns (a plain object of string -> string, an array of
 * `{find, replacement}` objects, or a `path.resolve/join(...)` call with
 * string-literal arguments). Anything computed (a variable reference,
 * spread, ternary, or unrecognized call) is left unresolved and reported as
 * a Gap rather than guessed or executed.
 */

import fs from "node:fs";
import path from "node:path";
import {
  Node,
  Project,
  SyntaxKind,
  ts,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
  type PropertyAssignment,
  type SourceFile,
} from "ts-morph";
import type { Gap, SourceLocation } from "@/lore/model";

export interface PathAlias {
  /** Specifier prefix to match, trailing "*" stripped (e.g. "@/" from "@/*"). */
  pattern: string;
  /** Target path prefix, relative to rootDir (posix separators), trailing "*" stripped. */
  target: string;
  /** "exact" for a webpack-style trailing-"$" alias or a non-wildcard tsconfig/package.json key; "prefix" otherwise. */
  matchType: "exact" | "prefix";
  source: SourceLocation;
}

export interface JsTsProjectConfig {
  /** Ordered highest-precedence-first, then longest-pattern-first within that. */
  aliases: PathAlias[];
  gaps: Gap[];
}

type SourceResult = { aliases: PathAlias[]; gaps: Gap[] };

const VITE_CONFIG_FILENAMES = [
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mts",
  "vite.config.mjs",
  "vite.config.cts",
  "vite.config.cjs",
];
const WEBPACK_CONFIG_FILENAMES = [
  "webpack.config.ts",
  "webpack.config.js",
  "webpack.config.cjs",
  "webpack.config.mjs",
];
const RSBUILD_CONFIG_FILENAMES = ["rsbuild.config.ts", "rsbuild.config.js"];
const ROLLUP_CONFIG_FILENAMES = [
  "rollup.config.js",
  "rollup.config.ts",
  "rollup.config.mjs",
  "rollup.config.cjs",
];
const NUXT_CONFIG_FILENAMES = ["nuxt.config.ts", "nuxt.config.js"];
const NEXT_CONFIG_FILENAMES = [
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
];
const BABEL_CONFIG_FILENAMES = [
  "babel.config.js",
  "babel.config.ts",
  "babel.config.json",
  ".babelrc",
  ".babelrc.json",
  ".babelrc.js",
];

function toPosixRelative(rootDir: string, absolutePath: string): string {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function findFirstExistingFile(
  rootDir: string,
  fileNames: string[]
): { filePath: string; fileName: string } | undefined {
  for (const fileName of fileNames) {
    const filePath = path.join(rootDir, fileName);
    if (fs.existsSync(filePath)) return { filePath, fileName };
  }
  return undefined;
}

function unparseableGap(fileName: string, detail = ""): Gap {
  return {
    certainty: "unknown",
    description: `Could not parse '${fileName}'${detail}.`,
    location: { filePath: fileName },
  };
}

/** Parses a config file's source text with a throwaway in-memory ts-morph Project; the file is never executed. */
function parseConfigFile(
  filePath: string,
  fileName: string,
  gaps: Gap[]
): SourceFile | undefined {
  try {
    const project = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: { allowJs: true },
    });
    return project.createSourceFile(
      fileName,
      fs.readFileSync(filePath, "utf-8")
    );
  } catch {
    gaps.push(unparseableGap(fileName));
    return undefined;
  }
}

function getPropName(prop: PropertyAssignment): string | undefined {
  const nameNode = prop.getNameNode();
  if (Node.isStringLiteral(nameNode)) return nameNode.getLiteralValue();
  if (Node.isIdentifier(nameNode)) return nameNode.getText();
  return undefined;
}

/**
 * Resolves an alias target expression to an absolute path without executing
 * anything: a string literal is resolved relative to `configFileDir`; a
 * `path.resolve(...)`/`path.join(...)` (or bare `resolve`/`join`) call is
 * resolved by joining whatever string-literal arguments it has, ignoring
 * non-literal arguments like `__dirname` — since these config files live at
 * the repo root in the overwhelming majority of real projects, using the
 * config file's own directory as the base covers that case without needing
 * to model `__dirname`/`import.meta.url` semantics. Anything else (a
 * variable reference, spread, ternary, unrecognized call) returns
 * `undefined` rather than a guess.
 */
function resolveAliasTargetLiteral(
  valueNode: Node,
  configFileDir: string
): string | undefined {
  if (Node.isStringLiteral(valueNode)) {
    return path.resolve(configFileDir, valueNode.getLiteralValue());
  }

  if (Node.isCallExpression(valueNode)) {
    const exprText = valueNode.getExpression().getText();
    if (!["path.resolve", "path.join", "resolve", "join"].includes(exprText)) {
      return undefined;
    }
    const literalSegments = valueNode
      .getArguments()
      .filter(Node.isStringLiteral)
      .map((arg) => arg.getLiteralValue());
    if (literalSegments.length === 0) return undefined;
    return path.resolve(configFileDir, ...literalSegments);
  }

  return undefined;
}

interface AliasEntry {
  /** May end with "$" (webpack's exact-match marker). */
  key: string;
  valueNode: Node;
}

function extractAliasEntriesFromObjectLiteral(
  objLiteral: ObjectLiteralExpression
): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const prop of objLiteral.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const key = getPropName(prop);
    const valueNode = prop.getInitializer();
    if (key === undefined || !valueNode) continue;
    entries.push({ key, valueNode });
  }
  return entries;
}

/** Rollup's `entries: [{find, replacement}]` / Vite's array alias form. */
function extractAliasEntriesFromArrayLiteral(
  arrLiteral: ArrayLiteralExpression
): AliasEntry[] {
  const entries: AliasEntry[] = [];
  for (const element of arrLiteral.getElements()) {
    if (!Node.isObjectLiteralExpression(element)) continue;
    let findValue: string | undefined;
    let replacementNode: Node | undefined;
    for (const prop of element.getProperties()) {
      if (!Node.isPropertyAssignment(prop)) continue;
      const propName = getPropName(prop);
      const valueNode = prop.getInitializer();
      if (propName === "find" && valueNode && Node.isStringLiteral(valueNode)) {
        findValue = valueNode.getLiteralValue();
      }
      if ((propName === "replacement" || propName === "target") && valueNode) {
        replacementNode = valueNode;
      }
    }
    if (findValue !== undefined && replacementNode) {
      entries.push({ key: findValue, valueNode: replacementNode });
    }
  }
  return entries;
}

function aliasEntriesToPathAliases(
  entries: AliasEntry[],
  configFileDir: string,
  rootDir: string,
  sourceFileName: string,
  configKey: string,
  gaps: Gap[]
): PathAlias[] {
  const result: PathAlias[] = [];
  for (const entry of entries) {
    const resolvedAbsolute = resolveAliasTargetLiteral(
      entry.valueNode,
      configFileDir
    );
    if (resolvedAbsolute === undefined) {
      gaps.push({
        certainty: "unknown",
        description: `Alias '${entry.key}' in '${sourceFileName}' has a computed value that could not be statically resolved without executing the config file.`,
        location: {
          filePath: sourceFileName,
          configKey,
          startLine: entry.valueNode.getStartLineNumber(),
        },
      });
      continue;
    }
    const exact = entry.key.endsWith("$");
    result.push({
      pattern: exact ? entry.key.slice(0, -1) : entry.key,
      target: toPosixRelative(rootDir, resolvedAbsolute),
      matchType: exact ? "exact" : "prefix",
      source: {
        filePath: sourceFileName,
        configKey,
        startLine: entry.valueNode.getStartLineNumber(),
      },
    });
  }
  return result;
}

/**
 * Object literals plausibly *the* config object, regardless of export
 * shape: the argument to a `defineConfig(...)` call, the expression of an
 * `export default`, or the right-hand side of `module.exports = {...}`. A
 * config that computes its object via a function (e.g.
 * `defineConfig((env) => ({...}))`) is out of scope — it isn't a literal, so
 * nothing here matches it, and any alias-shaped import in that repo simply
 * falls through to the existing "looks like an alias, unsupported" Gap.
 */
const DEFINE_CONFIG_CALL = /(^|\.)define\w*Config$/;

function findConfigObjectLiterals(
  sourceFile: SourceFile
): ObjectLiteralExpression[] {
  const candidates: ObjectLiteralExpression[] = [];

  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  )) {
    const exprText = call.getExpression().getText();
    // Covers vite/rollup's own `defineConfig`, namespaced `vite.defineConfig`,
    // and framework-specific wrappers like `defineNuxtConfig`.
    if (!DEFINE_CONFIG_CALL.test(exprText)) continue;
    for (const arg of call.getArguments()) {
      if (Node.isObjectLiteralExpression(arg)) candidates.push(arg);
    }
  }

  for (const exportAssignment of sourceFile.getExportAssignments()) {
    const expr = exportAssignment.getExpression();
    if (Node.isObjectLiteralExpression(expr)) candidates.push(expr);
  }

  for (const bin of sourceFile.getDescendantsOfKind(
    SyntaxKind.BinaryExpression
  )) {
    if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
    if (bin.getLeft().getText() !== "module.exports") continue;
    const right = bin.getRight();
    if (Node.isObjectLiteralExpression(right)) candidates.push(right);
  }

  return candidates;
}

function findPropertyValue(
  root: Node,
  propertyPath: string[]
): Node | undefined {
  let current: Node = root;
  for (const key of propertyPath) {
    if (!Node.isObjectLiteralExpression(current)) return undefined;
    const prop = current
      .getProperties()
      .find(
        (p): p is PropertyAssignment =>
          Node.isPropertyAssignment(p) && getPropName(p) === key
      );
    if (!prop) return undefined;
    const init = prop.getInitializer();
    if (!init) return undefined;
    current = init;
  }
  return current;
}

/** Shared reader for vite/webpack/rsbuild/nuxt: find the config object, then walk `propertyPath` to an alias object/array. */
function readAliasFromBundlerConfig(
  rootDir: string,
  fileNames: string[],
  propertyPath: string[]
): SourceResult | undefined {
  const found = findFirstExistingFile(rootDir, fileNames);
  if (!found) return undefined;

  const gaps: Gap[] = [];
  const sourceFile = parseConfigFile(found.filePath, found.fileName, gaps);
  if (!sourceFile) return { aliases: [], gaps };

  const aliases: PathAlias[] = [];
  for (const candidate of findConfigObjectLiterals(sourceFile)) {
    const aliasNode = findPropertyValue(candidate, propertyPath);
    if (!aliasNode) continue;
    const entries = Node.isObjectLiteralExpression(aliasNode)
      ? extractAliasEntriesFromObjectLiteral(aliasNode)
      : Node.isArrayLiteralExpression(aliasNode)
        ? extractAliasEntriesFromArrayLiteral(aliasNode)
        : [];
    aliases.push(
      ...aliasEntriesToPathAliases(
        entries,
        rootDir,
        rootDir,
        found.fileName,
        propertyPath.join("."),
        gaps
      )
    );
  }
  return { aliases, gaps };
}

function readViteConfig(rootDir: string): SourceResult | undefined {
  return readAliasFromBundlerConfig(rootDir, VITE_CONFIG_FILENAMES, [
    "resolve",
    "alias",
  ]);
}

function readWebpackConfig(rootDir: string): SourceResult | undefined {
  return readAliasFromBundlerConfig(rootDir, WEBPACK_CONFIG_FILENAMES, [
    "resolve",
    "alias",
  ]);
}

function readRsbuildConfig(rootDir: string): SourceResult | undefined {
  return readAliasFromBundlerConfig(rootDir, RSBUILD_CONFIG_FILENAMES, [
    "resolve",
    "alias",
  ]);
}

function readNuxtConfig(rootDir: string): SourceResult | undefined {
  return readAliasFromBundlerConfig(rootDir, NUXT_CONFIG_FILENAMES, ["alias"]);
}

/** `@rollup/plugin-alias`'s conventional call shape: `alias({ entries: [...] })` inside `plugins: [...]`. */
function readRollupConfig(rootDir: string): SourceResult | undefined {
  const found = findFirstExistingFile(rootDir, ROLLUP_CONFIG_FILENAMES);
  if (!found) return undefined;

  const gaps: Gap[] = [];
  const sourceFile = parseConfigFile(found.filePath, found.fileName, gaps);
  if (!sourceFile) return { aliases: [], gaps };

  const aliases: PathAlias[] = [];
  for (const call of sourceFile.getDescendantsOfKind(
    SyntaxKind.CallExpression
  )) {
    if (call.getExpression().getText() !== "alias") continue;
    for (const arg of call.getArguments()) {
      if (!Node.isObjectLiteralExpression(arg)) continue;
      const entriesNode = findPropertyValue(arg, ["entries"]);
      if (!entriesNode || !Node.isArrayLiteralExpression(entriesNode)) continue;
      const entries = extractAliasEntriesFromArrayLiteral(entriesNode);
      aliases.push(
        ...aliasEntriesToPathAliases(
          entries,
          rootDir,
          rootDir,
          found.fileName,
          "plugins.alias.entries",
          gaps
        )
      );
    }
  }
  return { aliases, gaps };
}

/**
 * Next.js has no first-class alias config (it inherits tsconfig `paths`
 * automatically) — the only common way to add one is mutating
 * `config.resolve.alias` inside a `webpack(config, ...) {...}` function.
 * Only that one assignment shape is recognized; anything else is left to
 * the existing alias-Gap path, since Next apps overwhelmingly rely on
 * tsconfig paths (already covered by `readTsOrJsConfig`).
 */
function readNextConfig(rootDir: string): SourceResult | undefined {
  const found = findFirstExistingFile(rootDir, NEXT_CONFIG_FILENAMES);
  if (!found) return undefined;

  const gaps: Gap[] = [];
  const sourceFile = parseConfigFile(found.filePath, found.fileName, gaps);
  if (!sourceFile) return { aliases: [], gaps };

  const aliases: PathAlias[] = [];

  // `webpack(config) {...}` object-literal method shorthand (the common
  // real-world shape) is a MethodDeclaration, not a FunctionExpression;
  // `webpack: function(config) {...}` / `webpack: (config) => {...}` are
  // FunctionExpression/ArrowFunction assigned via a PropertyAssignment.
  const webpackFns: Node[] = sourceFile
    .getDescendantsOfKind(SyntaxKind.MethodDeclaration)
    .filter((method) => method.getName() === "webpack");
  for (const fn of [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ]) {
    const parent = fn.getParent();
    if (
      Node.isPropertyAssignment(parent) &&
      getPropName(parent) === "webpack"
    ) {
      webpackFns.push(fn);
    }
  }

  for (const fn of webpackFns) {
    for (const bin of fn.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      if (bin.getLeft().getText() !== "config.resolve.alias") continue;
      const right = bin.getRight();
      if (!Node.isObjectLiteralExpression(right)) continue;
      const entries = extractAliasEntriesFromObjectLiteral(right);
      aliases.push(
        ...aliasEntriesToPathAliases(
          entries,
          rootDir,
          rootDir,
          found.fileName,
          "webpack.config.resolve.alias",
          gaps
        )
      );
    }
  }
  return { aliases, gaps };
}

/** `babel-plugin-module-resolver`'s `alias` option, in a `["module-resolver", { alias: {...} }]` tuple inside `plugins`. */
function extractBabelAliasFromParsedPluginsList(
  plugins: unknown,
  rootDir: string,
  fileName: string
): PathAlias[] {
  if (!Array.isArray(plugins)) return [];
  const aliases: PathAlias[] = [];
  for (const plugin of plugins) {
    if (!Array.isArray(plugin) || plugin.length < 2) continue;
    const [name, options] = plugin;
    if (typeof name !== "string" || !name.includes("module-resolver")) continue;
    if (typeof options !== "object" || options === null) continue;
    const alias = (options as Record<string, unknown>).alias;
    if (typeof alias !== "object" || alias === null) continue;
    for (const [key, value] of Object.entries(
      alias as Record<string, unknown>
    )) {
      if (typeof value !== "string") continue;
      const exact = key.endsWith("$");
      aliases.push({
        pattern: exact ? key.slice(0, -1) : key,
        target: toPosixRelative(rootDir, path.resolve(rootDir, value)),
        matchType: exact ? "exact" : "prefix",
        source: {
          filePath: fileName,
          configKey: "plugins.module-resolver.alias",
        },
      });
    }
  }
  return aliases;
}

function readBabelConfig(rootDir: string): SourceResult | undefined {
  const found = findFirstExistingFile(rootDir, BABEL_CONFIG_FILENAMES);
  if (!found) return undefined;

  const gaps: Gap[] = [];

  if (found.fileName.endsWith(".json") || found.fileName === ".babelrc") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(found.filePath, "utf-8"));
    } catch {
      gaps.push(unparseableGap(found.fileName, " as JSON"));
      return { aliases: [], gaps };
    }
    const plugins = (parsed as { plugins?: unknown } | null)?.plugins;
    return {
      aliases: extractBabelAliasFromParsedPluginsList(
        plugins,
        rootDir,
        found.fileName
      ),
      gaps,
    };
  }

  const sourceFile = parseConfigFile(found.filePath, found.fileName, gaps);
  if (!sourceFile) return { aliases: [], gaps };

  const aliases: PathAlias[] = [];
  for (const candidate of findConfigObjectLiterals(sourceFile)) {
    const pluginsNode = findPropertyValue(candidate, ["plugins"]);
    if (!pluginsNode || !Node.isArrayLiteralExpression(pluginsNode)) continue;
    for (const element of pluginsNode.getElements()) {
      if (!Node.isArrayLiteralExpression(element)) continue;
      const [nameEl, optionsEl] = element.getElements();
      if (!nameEl || !Node.isStringLiteral(nameEl)) continue;
      if (!nameEl.getLiteralValue().includes("module-resolver")) continue;
      if (!optionsEl || !Node.isObjectLiteralExpression(optionsEl)) continue;
      const aliasNode = findPropertyValue(optionsEl, ["alias"]);
      if (!aliasNode || !Node.isObjectLiteralExpression(aliasNode)) continue;
      const entries = extractAliasEntriesFromObjectLiteral(aliasNode);
      aliases.push(
        ...aliasEntriesToPathAliases(
          entries,
          rootDir,
          rootDir,
          found.fileName,
          "plugins.module-resolver.alias",
          gaps
        )
      );
    }
  }
  return { aliases, gaps };
}

/**
 * tsconfig.json / jsconfig.json, via ts-morph's re-exported `ts` namespace
 * (already a dependency — no new package needed): `ts.readConfigFile` +
 * `ts.parseJsonConfigFileContent` handle `extends` chains, comments, and
 * trailing commas the way `tsc`/`vscode` do. An `extends` target that isn't
 * present in the analyzed tree (e.g. an npm-published base config) is
 * skipped by TypeScript itself rather than treated as fatal.
 */
function readTsconfigLike(rootDir: string, fileName: string): SourceResult {
  const filePath = path.join(rootDir, fileName);
  const gaps: Gap[] = [];

  const readFile = (p: string): string | undefined => {
    try {
      return fs.readFileSync(p, "utf-8");
    } catch {
      return undefined;
    }
  };
  const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: true,
    readDirectory: () => [],
    fileExists: (p) => fs.existsSync(p),
    readFile,
  };

  let parsed: ts.ParsedCommandLine;
  try {
    const configFile = ts.readConfigFile(filePath, readFile);
    if (configFile.error || !configFile.config) {
      gaps.push(unparseableGap(fileName));
      return { aliases: [], gaps };
    }
    parsed = ts.parseJsonConfigFileContent(
      configFile.config,
      host,
      rootDir,
      undefined,
      filePath
    );
  } catch {
    gaps.push(unparseableGap(fileName));
    return { aliases: [], gaps };
  }

  const configPaths = parsed.options.paths;
  if (!configPaths) return { aliases: [], gaps };

  const baseUrl = parsed.options.baseUrl ?? rootDir;
  const aliases: PathAlias[] = [];
  for (const [key, targets] of Object.entries(configPaths)) {
    const keyIsWildcard = key.endsWith("*");
    const pattern = keyIsWildcard ? key.slice(0, -1) : key;
    for (const targetRaw of targets) {
      const targetIsWildcard = targetRaw.endsWith("*");
      const targetPath = targetIsWildcard ? targetRaw.slice(0, -1) : targetRaw;
      aliases.push({
        pattern,
        target: toPosixRelative(rootDir, path.resolve(baseUrl, targetPath)),
        matchType: keyIsWildcard ? "prefix" : "exact",
        source: { filePath: fileName, configKey: "compilerOptions.paths" },
      });
    }
  }
  return { aliases, gaps };
}

/** `tsconfig.json` is preferred over `jsconfig.json` when both exist (real-world convention: jsconfig is a JS-only fallback). */
function readTsOrJsConfig(rootDir: string): SourceResult | undefined {
  for (const fileName of ["tsconfig.json", "jsconfig.json"]) {
    if (fs.existsSync(path.join(rootDir, fileName))) {
      return readTsconfigLike(rootDir, fileName);
    }
  }
  return undefined;
}

/** Node's subpath-import map ("#foo" specifiers) — string-valued entries only; conditional (object-valued) entries aren't statically resolvable to one target. */
function readPackageJsonImports(rootDir: string): SourceResult | undefined {
  const filePath = path.join(rootDir, "package.json");
  if (!fs.existsSync(filePath)) return undefined;

  const gaps: Gap[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    gaps.push(unparseableGap("package.json", " as JSON"));
    return { aliases: [], gaps };
  }

  const imports = (parsed as { imports?: unknown } | null)?.imports;
  if (typeof imports !== "object" || imports === null)
    return { aliases: [], gaps };

  const aliases: PathAlias[] = [];
  for (const [key, value] of Object.entries(
    imports as Record<string, unknown>
  )) {
    if (typeof value !== "string") continue;
    const keyIsWildcard = key.endsWith("*");
    const pattern = keyIsWildcard ? key.slice(0, -1) : key;
    const targetIsWildcard = value.endsWith("*");
    const targetPath = targetIsWildcard ? value.slice(0, -1) : value;
    aliases.push({
      pattern,
      target: toPosixRelative(rootDir, path.resolve(rootDir, targetPath)),
      matchType: keyIsWildcard ? "prefix" : "exact",
      source: { filePath: "package.json", configKey: "imports" },
    });
  }
  return { aliases, gaps };
}

/**
 * Reads and merges path-alias configuration from every supported source
 * present in `rootDir`. Fixed precedence (highest first) when the same
 * alias key is declared in more than one source: whatever actually resolves
 * modules at build/runtime (a bundler/framework config) outranks a
 * declaration-only config (tsconfig/jsconfig), which outranks package.json
 * `imports` (Node's narrower subpath-import mechanism). A losing
 * declaration is simply dropped, not reported as a Gap — this is a merge
 * decision, not an analysis limitation.
 */
export function readJsTsProjectConfig(rootDir: string): JsTsProjectConfig {
  const absoluteRoot = path.resolve(rootDir);

  const readers: Array<() => SourceResult | undefined> = [
    () => readViteConfig(absoluteRoot),
    () => readWebpackConfig(absoluteRoot),
    () => readRsbuildConfig(absoluteRoot),
    () => readRollupConfig(absoluteRoot),
    () => readNuxtConfig(absoluteRoot),
    () => readNextConfig(absoluteRoot),
    () => readBabelConfig(absoluteRoot),
    () => readTsOrJsConfig(absoluteRoot),
    () => readPackageJsonImports(absoluteRoot),
  ];

  const aliases: PathAlias[] = [];
  const gaps: Gap[] = [];
  const seenPatterns = new Set<string>();

  for (const read of readers) {
    const result = read();
    if (!result) continue;
    gaps.push(...result.gaps);
    for (const alias of result.aliases) {
      if (seenPatterns.has(alias.pattern)) continue;
      seenPatterns.add(alias.pattern);
      aliases.push(alias);
    }
  }

  // Longest pattern first, so a more specific alias (e.g. "@/components/")
  // is tried before a broader one (e.g. "@/") when both are configured.
  aliases.sort((a, b) => b.pattern.length - a.pattern.length);

  return { aliases, gaps };
}
