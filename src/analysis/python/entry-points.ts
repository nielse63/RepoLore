/**
 * Entry-point heuristics: declared console-script entries first (detected),
 * then the `__main__.py` convention, then a top-level `if __name__ ==
 * "__main__":` bootstrap guard, then a conventional fallback — mirroring
 * the JS/TS extractor's declared-field-first, convention-last precedence.
 */

import type { Node as TSNode } from "web-tree-sitter";
import type { EntryPoint } from "@/lore/model";
import type { PythonSourceFile } from "./discovery";
import { buildModuleResolutionIndex } from "./module-resolution";
import type { PythonProjectConfig } from "./project-config";
import {
  directChildrenOfType,
  isStringLiteral,
  stringLiteralValue,
} from "./syntax";
import { isTestFile } from "./tests";

/**
 * True if a top-level `if` statement is a `__name__ == "__main__"` guard
 * (in either operand order). Only direct children of the module are
 * checked — the guard is always module-level in real Python code, and
 * restricting to top-level avoids matching an unrelated nested check.
 */
function isNameMainGuard(ifStatement: TSNode): boolean {
  const condition = ifStatement.childForFieldName("condition");
  if (!condition || condition.type !== "comparison_operator") return false;
  const operands = condition.namedChildren.filter(
    (n): n is TSNode => n !== null
  );
  if (operands.length !== 2) return false;
  const isDunderName = (n: TSNode) =>
    n.type === "identifier" && n.text === "__name__";
  const isMainString = (n: TSNode) =>
    isStringLiteral(n) && stringLiteralValue(n) === "__main__";
  const [a, b] = operands;
  return (
    (isDunderName(a) && isMainString(b)) || (isDunderName(b) && isMainString(a))
  );
}

function moduleSegmentsFromDottedPath(dottedPath: string): string[] {
  return dottedPath.split(".").filter((s) => s.length > 0);
}

export function extractEntryPoints(
  sourceFiles: PythonSourceFile[],
  rootDir: string,
  config: PythonProjectConfig
): EntryPoint[] {
  const resolver = buildModuleResolutionIndex(sourceFiles, rootDir);
  const entryPoints: EntryPoint[] = [];
  const claimedPaths = new Set<string>();

  // 1. Declared console-script entries (pyproject.toml / setup.py).
  for (const script of config.consoleScripts) {
    const [modulePart] = script.target.split(":");
    const resolved = resolver.resolveUnderRoots(
      moduleSegmentsFromDottedPath(modulePart)
    );
    if (!resolved || claimedPaths.has(resolved.relativePath)) continue;
    claimedPaths.add(resolved.relativePath);
    entryPoints.push({
      id: `python-entry-console-script-${script.name}`,
      kind: "cli",
      location: { filePath: resolved.relativePath },
      certainty: "detected",
      evidence: [
        {
          kind: "console-script-declaration",
          certainty: "detected",
          location: {
            filePath: script.sourceFile,
            configKey: script.configKey,
          },
          description: `${script.sourceFile} declares console script "${script.name}" -> "${script.target}".`,
        },
      ],
    });
  }

  // 2. The `__main__.py` convention (`python -m package` runs it).
  for (const sourceFile of sourceFiles) {
    if (claimedPaths.has(sourceFile.relativePath)) continue;
    if (
      !sourceFile.relativePath.endsWith("/__main__.py") &&
      sourceFile.relativePath !== "__main__.py"
    ) {
      continue;
    }
    claimedPaths.add(sourceFile.relativePath);
    entryPoints.push({
      id: `python-entry-dunder-main-${sourceFile.relativePath}`,
      kind: "cli",
      location: { filePath: sourceFile.relativePath },
      certainty: "detected",
      evidence: [
        {
          kind: "conventional-dunder-main-file",
          certainty: "detected",
          location: { filePath: sourceFile.relativePath },
          description: `'${sourceFile.relativePath}' is a __main__.py, run via 'python -m' on its package.`,
        },
      ],
    });
  }

  // 3. A top-level `if __name__ == "__main__":` bootstrap guard. Test files
  // are skipped even when they happen to match (e.g. a `unittest.main()`
  // guard) — never a real application entry point.
  for (const sourceFile of sourceFiles) {
    if (claimedPaths.has(sourceFile.relativePath)) continue;
    if (isTestFile(sourceFile.relativePath)) continue;
    const hasGuard = directChildrenOfType(
      sourceFile.tree.rootNode,
      "if_statement"
    ).some(isNameMainGuard);
    if (!hasGuard) continue;
    claimedPaths.add(sourceFile.relativePath);
    entryPoints.push({
      id: `python-entry-bootstrap-${sourceFile.relativePath}`,
      kind: "bootstrap",
      location: { filePath: sourceFile.relativePath },
      certainty: "detected",
      evidence: [
        {
          kind: "name-main-guard",
          certainty: "detected",
          location: { filePath: sourceFile.relativePath },
          description: `'${sourceFile.relativePath}' has a top-level 'if __name__ == "__main__":' guard.`,
        },
      ],
    });
  }

  // 4. The project's declared package name resolving to a package's
  // `__init__.py` is its public library entry point (mirrors JS/TS's
  // package.json `main`/`exports` field).
  if (config.name) {
    const normalized = config.name.replace(/-/g, "_");
    const resolved = resolver.resolveUnderRoots([normalized]);
    if (
      resolved &&
      resolved.relativePath.endsWith("__init__.py") &&
      !claimedPaths.has(resolved.relativePath)
    ) {
      claimedPaths.add(resolved.relativePath);
      entryPoints.push({
        id: "python-entry-package-init",
        kind: "library",
        location: { filePath: resolved.relativePath },
        certainty: "detected",
        evidence: [
          {
            kind: "package-config-field",
            certainty: "detected",
            location: {
              filePath: config.nameSourceFile ?? "pyproject.toml",
              configKey: config.nameConfigKey,
            },
            description: `Project name "${config.name}" resolves to package '${resolved.relativePath}'.`,
          },
        ],
      });
    }
  }

  // 5. Conventional fallback: a top-level or src/ "main.py", when nothing
  // more specific was found.
  if (entryPoints.length === 0) {
    for (const candidate of ["main.py", "src/main.py"]) {
      const found = sourceFiles.find((sf) => sf.relativePath === candidate);
      if (!found) continue;
      entryPoints.push({
        id: `python-entry-convention-${found.relativePath}`,
        kind: "runtime",
        location: { filePath: found.relativePath },
        certainty: "inferred",
        evidence: [
          {
            kind: "conventional-main-file",
            certainty: "inferred",
            location: { filePath: found.relativePath },
            description: `No console-script or __main__.py entry was found; '${found.relativePath}' matches the conventional main-file location.`,
          },
        ],
      });
      break;
    }
  }

  return entryPoints;
}
