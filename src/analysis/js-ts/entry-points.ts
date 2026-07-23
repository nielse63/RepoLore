/**
 * Entry-point heuristics: `package.json` declared fields first (detected),
 * falling back to conventional index files and a runtime-bootstrap call
 * pattern (inferred/detected respectively) when no manifest field applies.
 */

import fs from "node:fs";
import path from "node:path";
import { SyntaxKind, type SourceFile } from "ts-morph";
import type { EntryPoint } from "@/lore/model";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

function findSourceFileByRelativePath(
  sourceFiles: SourceFile[],
  rootDir: string,
  relativePath: string,
): SourceFile | undefined {
  const candidates = [
    relativePath,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    `${relativePath}.js`,
    `${relativePath}.jsx`,
  ];
  return sourceFiles.find((sf) =>
    candidates.includes(toRelative(rootDir, sf.getFilePath())),
  );
}

type ExportsField = string | Record<string, unknown>;

interface PackageJson {
  main?: string;
  module?: string;
  bin?: string | Record<string, string>;
  exports?: ExportsField;
}

function readPackageJson(rootDir: string): PackageJson | undefined {
  const pkgPath = path.join(rootDir, "package.json");
  if (!fs.existsSync(pkgPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;
  } catch {
    return undefined;
  }
}

/**
 * Resolves a `package.json` `exports` field to a single specifier, for the
 * common single-entry-point package shape: a bare string, a subpath map with
 * a "." key, or a conditions object (preferring "import"/"default" over
 * "require", and skipping "types", since ts-morph parses source, not
 * declaration files).
 */
function resolveExportsField(exportsField: ExportsField): string | undefined {
  if (typeof exportsField === "string") return exportsField;

  const dotExport = exportsField["."];
  if (typeof dotExport === "string") return dotExport;
  if (dotExport && typeof dotExport === "object") {
    return resolveExportsField(dotExport as Record<string, unknown>);
  }

  for (const condition of ["import", "default"]) {
    const value = exportsField[condition];
    if (typeof value === "string") return value;
  }
  for (const [key, value] of Object.entries(exportsField)) {
    if (key === "types" || typeof value !== "string") continue;
    return value;
  }
  return undefined;
}

/** True if a file calls `ReactDOM`'s (or `react-dom/client`'s) `render`/`createRoot(...).render`. */
function callsReactDomRender(sourceFile: SourceFile): boolean {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const text = call.getExpression().getText();
      return /(^|\.)render$/.test(text) || /createRoot/.test(text);
    });
}

export function extractEntryPoints(
  sourceFiles: SourceFile[],
  rootDir: string,
): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];
  const pkg = readPackageJson(rootDir);
  const claimedPaths = new Set<string>();

  function addManifestEntry(
    field: "main" | "module",
    kind: EntryPoint["kind"],
  ) {
    const value = pkg?.[field];
    if (!value) return;
    const relativeValue = value.startsWith("./") ? value.slice(2) : value;
    const resolved = findSourceFileByRelativePath(sourceFiles, rootDir, relativeValue);
    if (!resolved) return;
    const filePath = toRelative(rootDir, resolved.getFilePath());
    if (claimedPaths.has(filePath)) return;
    claimedPaths.add(filePath);
    entryPoints.push({
      id: `js-ts-entry-package-${field}`,
      kind,
      location: { filePath },
      certainty: "detected",
      evidence: [
        {
          kind: "package-json-field",
          certainty: "detected",
          location: { filePath: "package.json", configKey: field },
          description: `package.json declares "${field}": "${value}".`,
        },
      ],
    });
  }

  // The modern `exports` field takes precedence over `main`/`module` when a
  // package declares one (Node and bundlers resolve it first).
  if (pkg?.exports !== undefined) {
    const resolvedSpecifier = resolveExportsField(pkg.exports);
    if (resolvedSpecifier) {
      const relativeValue = resolvedSpecifier.startsWith("./")
        ? resolvedSpecifier.slice(2)
        : resolvedSpecifier;
      const resolved = findSourceFileByRelativePath(sourceFiles, rootDir, relativeValue);
      if (resolved) {
        const filePath = toRelative(rootDir, resolved.getFilePath());
        claimedPaths.add(filePath);
        entryPoints.push({
          id: "js-ts-entry-package-exports",
          kind: "library",
          location: { filePath },
          certainty: "detected",
          evidence: [
            {
              kind: "package-json-field",
              certainty: "detected",
              location: { filePath: "package.json", configKey: "exports" },
              description: `package.json declares "exports" resolving to "${resolvedSpecifier}".`,
            },
          ],
        });
      }
    }
  }

  addManifestEntry("main", "library");
  addManifestEntry("module", "library");

  if (pkg?.bin) {
    const binEntries =
      typeof pkg.bin === "string" ? { [pkg.bin]: pkg.bin } : pkg.bin;
    for (const [name, value] of Object.entries(binEntries)) {
      const relativeValue = value.startsWith("./") ? value.slice(2) : value;
      const resolved = findSourceFileByRelativePath(sourceFiles, rootDir, relativeValue);
      if (!resolved) continue;
      const filePath = toRelative(rootDir, resolved.getFilePath());
      claimedPaths.add(filePath);
      entryPoints.push({
        id: `js-ts-entry-bin-${name}`,
        kind: "cli",
        location: { filePath },
        certainty: "detected",
        evidence: [
          {
            kind: "package-json-field",
            certainty: "detected",
            location: { filePath: "package.json", configKey: `bin.${name}` },
            description: `package.json declares command "${name}" at "${value}".`,
          },
        ],
      });
    }
  }

  // Runtime-bootstrap heuristic: a file that calls ReactDOM's render/createRoot.
  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    if (claimedPaths.has(filePath)) continue;
    if (!callsReactDomRender(sourceFile)) continue;
    claimedPaths.add(filePath);
    entryPoints.push({
      id: `js-ts-entry-bootstrap-${filePath}`,
      kind: "bootstrap",
      location: { filePath },
      certainty: "detected",
      evidence: [
        {
          kind: "react-dom-render-call",
          certainty: "detected",
          location: { filePath },
          description: `'${filePath}' calls React DOM's render/createRoot, mounting the application.`,
        },
      ],
    });
  }

  // Conventional fallback: a top-level or src/ "index" file, when nothing
  // more specific was found.
  if (entryPoints.length === 0) {
    const conventionalCandidates = [
      "src/index.ts",
      "src/index.tsx",
      "src/index.js",
      "src/index.jsx",
      "index.ts",
      "index.tsx",
      "index.js",
      "index.jsx",
    ];
    for (const candidate of conventionalCandidates) {
      const resolved = findSourceFileByRelativePath(sourceFiles, rootDir, candidate);
      if (!resolved) continue;
      const filePath = toRelative(rootDir, resolved.getFilePath());
      entryPoints.push({
        id: `js-ts-entry-convention-${filePath}`,
        kind: "runtime",
        location: { filePath },
        certainty: "inferred",
        evidence: [
          {
            kind: "conventional-index-file",
            certainty: "inferred",
            location: { filePath },
            description: `No package.json entry field was found; '${filePath}' matches the conventional index-file location.`,
          },
        ],
      });
      break;
    }
  }

  return entryPoints;
}
