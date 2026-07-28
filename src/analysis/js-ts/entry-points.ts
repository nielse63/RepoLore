/**
 * Entry-point heuristics: `package.json` declared fields first (detected),
 * falling back to conventional index files and a runtime-bootstrap call
 * pattern (inferred/detected respectively) when no manifest field applies.
 */

import fs from "node:fs";
import path from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { EntryPoint } from "@/lore/model";
import { isTestFile } from "./tests";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

function findSourceFileByRelativePath(
  sourceFiles: SourceFile[],
  rootDir: string,
  relativePath: string
): SourceFile | undefined {
  const candidates = [
    relativePath,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    `${relativePath}.js`,
    `${relativePath}.jsx`,
  ];
  return sourceFiles.find((sf) =>
    candidates.includes(toRelative(rootDir, sf.getFilePath()))
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

/**
 * True for a call expression shaped like `X.render(...)`, where `X` is a
 * real reference (an identifier, `this`, or another call/property access —
 * e.g. `createRoot(el).render(...)`), never a bare `render(...)` call — real
 * bootstrap code always calls render on the `ReactDOM` import or a
 * root/container object, never a standalone function named `render`. A
 * bare-name match previously misclassified React Testing Library's
 * `render(<Component />)` in test files as an application bootstrap entry
 * point, found validating against a real repository
 * (`pieces-app/example-typescript`) in implementation session 6.
 */
function isRenderPropertyAccessCall(callee: Node): boolean {
  if (!Node.isPropertyAccessExpression(callee)) return false;
  if (callee.getName() !== "render") return false;
  const object = callee.getExpression();
  return (
    Node.isIdentifier(object) ||
    Node.isThisExpression(object) ||
    Node.isCallExpression(object) ||
    Node.isPropertyAccessExpression(object)
  );
}

/** True for a call expression shaped like `createRoot(...)` or `ReactDOM.createRoot(...)`. */
function isCreateRootCall(callee: Node): boolean {
  if (Node.isIdentifier(callee)) return callee.getText() === "createRoot";
  if (Node.isPropertyAccessExpression(callee))
    return callee.getName() === "createRoot";
  return false;
}

/**
 * True if a file calls `ReactDOM`'s (or `react-dom/client`'s)
 * `X.render(...)`/`createRoot(...).render(...)`. Matches on the call
 * expression's AST shape (a real property-access/identifier reference)
 * rather than serialized text — a text-substring match previously
 * misclassified this very file (`entry-points.ts`) as its own application's
 * bootstrap entry, since this function's own `/createRoot/.test(text)`
 * detection code contains the literal substring "createRoot" in a regex
 * literal, not an actual ReactDOM call.
 */
function callsReactDomRender(sourceFile: SourceFile): boolean {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const callee = call.getExpression();
      return isRenderPropertyAccessCall(callee) || isCreateRootCall(callee);
    });
}

export function extractEntryPoints(
  sourceFiles: SourceFile[],
  rootDir: string
): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];
  const pkg = readPackageJson(rootDir);
  const claimedPaths = new Set<string>();

  function addManifestEntry(
    field: "main" | "module",
    kind: EntryPoint["kind"]
  ) {
    const value = pkg?.[field];
    if (!value) return;
    const relativeValue = value.startsWith("./") ? value.slice(2) : value;
    const resolved = findSourceFileByRelativePath(
      sourceFiles,
      rootDir,
      relativeValue
    );
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
      const resolved = findSourceFileByRelativePath(
        sourceFiles,
        rootDir,
        relativeValue
      );
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
      const resolved = findSourceFileByRelativePath(
        sourceFiles,
        rootDir,
        relativeValue
      );
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
  // Test files are skipped even when they happen to match — defense in depth
  // alongside the `.render` property-access requirement above, since a test
  // file is never the application's real bootstrap entry point.
  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    if (claimedPaths.has(filePath)) continue;
    if (isTestFile(filePath)) continue;
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
      const resolved = findSourceFileByRelativePath(
        sourceFiles,
        rootDir,
        candidate
      );
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
