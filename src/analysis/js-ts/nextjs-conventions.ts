/**
 * Next.js App Router convention recognition (ADR-0013, prompt §3
 * "Next.js" / §4 "System Entry Points"): filename conventions
 * (`page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts`) plus exported
 * handler shape (`GET`/`POST`/etc., a default export, `'use server'`)
 * produce new `EntryPoint`s using the extended `EntryPointKind`s.
 * `certainty` is `"detected"` when both the filename and the expected
 * export shape are present, `"inferred"` when only the filename matches.
 *
 * Deliberately narrow (prompt §3's "do not attempt every Next.js
 * convention in one pass"): App Router only (no Pages Router
 * `pages/api/*`), and `generateMetadata`/`generateStaticParams` are
 * recognized but not exhaustively validated beyond their export name.
 * `EntryPoint.location` (filePath + optional symbolName) is enough to
 * match a Next.js entry point back to its `CallableSignature` — no new
 * edge type is needed for this recognition alone.
 */

import path from "node:path";
import { Node, type FunctionDeclaration, type SourceFile } from "ts-morph";
import type { EntryPoint, Evidence } from "@/lore/model";

const ROUTE_HANDLER_NAMES = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

function baseNameWithoutExt(filePath: string): string {
  return path.basename(filePath).replace(/\.(tsx|ts|jsx|js)$/, "");
}

function defaultExportName(sourceFile: SourceFile): string | undefined {
  const defaultFn = sourceFile
    .getFunctions()
    .find((f: FunctionDeclaration) => f.isDefaultExport());
  if (defaultFn) return defaultFn.getName();

  const exportAssignment = sourceFile
    .getExportAssignments()
    .find((e) => !e.isExportEquals());
  const expr = exportAssignment?.getExpression();
  return expr && Node.isIdentifier(expr) ? expr.getText() : undefined;
}

function hasUseServerDirective(sourceFile: SourceFile): boolean {
  const [first] = sourceFile.getStatements();
  if (!first || !Node.isExpressionStatement(first)) return false;
  const expression = first.getExpression();
  return (
    Node.isStringLiteral(expression) &&
    expression.getLiteralText() === "use server"
  );
}

function pushEntry(
  entryPoints: EntryPoint[],
  filePath: string,
  symbolName: string | undefined,
  kind: EntryPoint["kind"],
  startLine: number | undefined,
  evidenceKind: string,
  certainty: Evidence["certainty"],
  description: string
) {
  const location = { filePath, symbolName, startLine };
  entryPoints.push({
    id: `js-ts-nextjs-${entryPoints.length + 1}`,
    kind,
    location,
    certainty,
    evidence: [{ kind: evidenceKind, certainty, location, description }],
  });
}

export function detectNextjsConventions(
  sourceFiles: SourceFile[],
  rootDir: string
): EntryPoint[] {
  const entryPoints: EntryPoint[] = [];

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const base = baseNameWithoutExt(filePath);

    if (base === "page" || base === "layout") {
      const name = defaultExportName(sourceFile);
      pushEntry(
        entryPoints,
        filePath,
        name,
        "route",
        undefined,
        "nextjs-page-convention",
        name ? "detected" : "inferred",
        name
          ? `'${filePath}' matches Next.js's '${base}' file convention, default-exporting '${name}'.`
          : `'${filePath}' matches Next.js's '${base}' file convention, but no default export was found to identify the component.`
      );

      for (const fn of sourceFile.getFunctions()) {
        if (
          fn.getName() === "generateMetadata" ||
          fn.getName() === "generateStaticParams"
        ) {
          pushEntry(
            entryPoints,
            filePath,
            fn.getName(),
            "framework",
            fn.getStartLineNumber(),
            "nextjs-lifecycle-export",
            "detected",
            `'${fn.getName()}' in '${filePath}' is a Next.js ${base} lifecycle export.`
          );
        }
      }
      continue;
    }

    if (base === "route") {
      let foundHandler = false;
      for (const fn of sourceFile.getFunctions()) {
        const name = fn.getName();
        if (!name || !ROUTE_HANDLER_NAMES.includes(name)) continue;
        foundHandler = true;
        pushEntry(
          entryPoints,
          filePath,
          name,
          "http-handler",
          fn.getStartLineNumber(),
          "nextjs-route-handler-export",
          "detected",
          `'${name}' in '${filePath}' is a Next.js Route Handler export.`
        );
      }
      if (!foundHandler) {
        pushEntry(
          entryPoints,
          filePath,
          undefined,
          "http-handler",
          undefined,
          "nextjs-route-convention",
          "inferred",
          `'${filePath}' matches Next.js's 'route' file convention, but no recognized HTTP method export (${ROUTE_HANDLER_NAMES.join(", ")}) was found.`
        );
      }
      continue;
    }

    if (base === "middleware") {
      const name = defaultExportName(sourceFile) ?? "middleware";
      const hasMiddlewareExport =
        defaultExportName(sourceFile) !== undefined ||
        sourceFile
          .getFunctions()
          .some((fn) => fn.getName() === "middleware" && fn.isExported());
      pushEntry(
        entryPoints,
        filePath,
        name,
        "middleware",
        undefined,
        "nextjs-middleware-convention",
        hasMiddlewareExport ? "detected" : "inferred",
        hasMiddlewareExport
          ? `'${filePath}' matches Next.js's 'middleware' file convention, exporting '${name}'.`
          : `'${filePath}' matches Next.js's 'middleware' file convention, but no recognized middleware export was found.`
      );
      continue;
    }

    if (hasUseServerDirective(sourceFile)) {
      for (const fn of sourceFile.getFunctions()) {
        if (!fn.isExported() || !fn.isAsync()) continue;
        const name = fn.getName();
        if (!name) continue;
        pushEntry(
          entryPoints,
          filePath,
          name,
          "server-action",
          fn.getStartLineNumber(),
          "nextjs-server-action-directive",
          "detected",
          `'${name}' in '${filePath}' is a Server Action ('use server' directive).`
        );
      }
    }
  }

  return entryPoints;
}
