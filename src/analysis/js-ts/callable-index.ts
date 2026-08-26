/**
 * Named-callable collection and "nearest enclosing named callable"
 * resolution, extracted from `call-graph.ts` (ADR-0012) so the Program
 * Behavior Graph's framework detectors (`react-hooks.ts`, `react-events.ts`,
 * `react-effects.ts`, ADR-0013) can attribute state/event/framework edges to
 * the same `CallableSignature`s the call graph already tracks, instead of
 * re-walking each file's AST to rediscover them. Behavior is unchanged from
 * its original location in `call-graph.ts` — this is a pure extraction.
 */

import path from "node:path";
import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  type SourceFile,
} from "ts-morph";
import type { CallableParameter, CallableSignature } from "@/lore/model";
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
} from "./module-resolution";

export function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

export type FunctionLike =
  FunctionDeclaration | FunctionExpression | ArrowFunction | MethodDeclaration;

/** The declared name of a callable: its own name for a function/method declaration, or the name of the variable/property it's assigned to for an arrow function or function expression. Returns `undefined` for anything with no meaningful name (e.g. an inline callback), which callers use to exclude it from the call graph entirely. */
function declaredName(fn: FunctionLike): string | undefined {
  if (Node.isMethodDeclaration(fn)) return fn.getName();
  if (Node.isFunctionDeclaration(fn) || Node.isFunctionExpression(fn)) {
    const name = fn.getName();
    if (name) return name;
  }
  const parent = fn.getParent();
  if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) {
    return parent.getName();
  }
  return undefined;
}

function kindOf(fn: FunctionLike): CallableSignature["kind"] {
  if (Node.isMethodDeclaration(fn)) return "method";
  if (Node.isFunctionDeclaration(fn)) return "function";
  if (Node.isFunctionExpression(fn)) return "function-expression";
  return "arrow";
}

function extractParameters(fn: FunctionLike): CallableParameter[] {
  return fn.getParameters().map((p) => {
    const name = p.getNameNode().getText();
    const typeNode = p.getTypeNode();
    return typeNode
      ? {
          name,
          typeAnnotation: typeNode.getText(),
          certainty: "detected" as const,
        }
      : { name, certainty: "unknown" as const };
  });
}

function extractReturnType(
  fn: FunctionLike
): Pick<CallableSignature, "returnType" | "returnCertainty"> {
  const returnTypeNode = fn.getReturnTypeNode();
  return returnTypeNode
    ? { returnType: returnTypeNode.getText(), returnCertainty: "detected" }
    : { returnCertainty: "unknown" };
}

export interface CollectedCallable {
  node: FunctionLike;
  signature: CallableSignature;
}

/** Every named function declaration (including nested ones), named class method, and named arrow/function-expression in a file. Overload signatures and abstract method declarations (no body) are excluded — only the implementation is a real callable. */
export function collectCallables(
  sourceFile: SourceFile,
  rootDir: string,
  nextId: () => string
): CollectedCallable[] {
  const filePath = toRelative(rootDir, sourceFile.getFilePath());
  const candidates: FunctionLike[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getClasses().flatMap((c) => c.getMethods()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
  ];

  const collected: CollectedCallable[] = [];
  for (const fn of candidates) {
    if (fn.getBody() === undefined) continue;
    const name = declaredName(fn);
    if (!name) continue;

    const location = {
      filePath,
      symbolName: name,
      startLine: fn.getStartLineNumber(),
    };
    collected.push({
      node: fn,
      signature: {
        id: nextId(),
        name,
        kind: kindOf(fn),
        location,
        parameters: extractParameters(fn),
        ...extractReturnType(fn),
        evidence: [
          {
            kind: "function-declaration",
            certainty: "detected",
            location,
            description: `'${name}' is declared in '${filePath}'.`,
          },
        ],
      },
    });
  }
  return collected;
}

/** The nearest enclosing tracked callable for any AST node, or undefined if the node sits at module scope or inside an untracked (anonymous) function. Anonymous functions are skipped transparently — a node inside an anonymous callback attributes to the nearest *named* ancestor, mirroring how `call-graph.ts`'s call resolution has always behaved. */
export function enclosingNamedCallable(
  node: Node,
  byNode: Map<Node, CollectedCallable>
): CollectedCallable | undefined {
  const ancestor = node.getFirstAncestor((a) => byNode.has(a));
  return ancestor ? byNode.get(ancestor) : undefined;
}

export interface FileCallableIndex {
  byNode: Map<Node, CollectedCallable>;
  byName: Map<string, CollectedCallable[]>;
}

export interface CallableIndex {
  /** Repo-relative file path -> that file's callables, indexed two ways. */
  byFilePath: Map<string, FileCallableIndex>;
  /** Every collected callable across all files, in discovery order. */
  all: CollectedCallable[];
}

/** Builds the callable index once per extraction run; `call-graph.ts` and the framework detectors (ADR-0013) share this single AST walk rather than each re-discovering named callables independently. */
export function buildCallableIndex(
  sourceFiles: SourceFile[],
  rootDir: string
): CallableIndex {
  let callableCount = 0;
  const byFilePath = new Map<string, FileCallableIndex>();
  const all: CollectedCallable[] = [];

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const collected = collectCallables(
      sourceFile,
      rootDir,
      () => `js-ts-callable-${++callableCount}`
    );

    const byNode = new Map(collected.map((c) => [c.node as Node, c]));
    const byName = new Map<string, CollectedCallable[]>();
    for (const c of collected) {
      const list = byName.get(c.signature.name) ?? [];
      list.push(c);
      byName.set(c.signature.name, list);
    }

    byFilePath.set(filePath, { byNode, byName });
    all.push(...collected);
  }

  return { byFilePath, all };
}

/** Locally-bound names imported via a *named* (not default) relative import in this file, mapped to the resolved target file and the name they're bound to there. Default imports are out of scope (ADR-0012) — matching a default export back to a specific callable would need import/export-shape handling this version doesn't attempt. Shared by `call-graph.ts` and the framework detectors (ADR-0013) that also resolve plain-identifier references to a named callable. */
export function namedRelativeImportsForFile(
  sourceFile: SourceFile,
  rootDir: string,
  resolver: ReturnType<typeof buildModuleResolutionIndex>
): Map<string, { targetFile: string; importedName: string }> {
  const result = new Map<
    string,
    { targetFile: string; importedName: string }
  >();
  for (const importDecl of sourceFile.getImportDeclarations()) {
    const specifier = importDecl.getModuleSpecifierValue();
    if (!isRelativeSpecifier(specifier)) continue;
    const resolved = resolver.resolve(sourceFile.getFilePath(), specifier);
    if (!resolved) continue;
    const targetFile = toRelative(rootDir, resolved.getFilePath());
    for (const named of importDecl.getNamedImports()) {
      const localName = named.getAliasNode()?.getText() ?? named.getName();
      result.set(localName, { targetFile, importedName: named.getName() });
    }
  }
  return result;
}

/**
 * Resolves a plain identifier name to a single named callable: a same-file
 * match if unambiguous, otherwise a callable reached through a named
 * relative import. Returns `undefined` (never a guess) when there's no
 * match or the match is ambiguous (more than one same-named callable in the
 * same file) — the same "fail gracefully rather than manufacturing
 * certainty" discipline `call-graph.ts` established (ADR-0012), reused by
 * the framework detectors (ADR-0013) that also resolve identifiers to
 * callables (event handlers, effect bodies).
 */
export function resolveNamedCallable(
  name: string,
  fileIndex: FileCallableIndex,
  imported: Map<string, { targetFile: string; importedName: string }>,
  index: CallableIndex
): CollectedCallable | undefined {
  const sameFileMatches = fileIndex.byName.get(name);
  if (sameFileMatches && sameFileMatches.length === 1) {
    return sameFileMatches[0];
  }
  if (sameFileMatches && sameFileMatches.length > 1) return undefined;

  const target = imported.get(name);
  if (!target) return undefined;
  const targetMatches = index.byFilePath
    .get(target.targetFile)
    ?.byName.get(target.importedName);
  return targetMatches && targetMatches.length === 1
    ? targetMatches[0]
    : undefined;
}
