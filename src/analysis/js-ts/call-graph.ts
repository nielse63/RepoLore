/**
 * Extracts a function-level call graph (ADR-0012): named functions, methods,
 * and named arrow/function-expressions as `CallableSignature`s, plus
 * `CallEdge`s for statically resolvable direct calls between them.
 *
 * Scope (see ADR-0012 for the full rationale): only plain-identifier calls
 * (`foo()`) are ever attempted — never property-access/method calls
 * (`obj.foo()`, `this.foo()`), computed calls (`obj[x]()`), or calls through
 * a variable/callback. A resolved call becomes a `detected` `CallEdge` only
 * when the identifier unambiguously matches a same-file named callable or a
 * callable reached through a *named* (not default) relative import, resolved
 * the same way `imports.ts`/`module-resolution.ts` resolve file-level edges.
 * Everything else that doesn't resolve this way is silently out of scope —
 * not recorded as a per-call-site `Gap` — since method calls and callbacks
 * are the dominant call shape in real JS/TS, and gapping every instance
 * would flood the model far worse than the pre-fix asset-import case
 * `module-resolution.ts` already guards against. Anonymous function
 * expressions/arrow functions (not assigned to a name) are not tracked as
 * `CallableSignature`s at all — there is no name to search for or display.
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
import type {
  CallableParameter,
  CallableSignature,
  CallEdge,
  SourceLocation,
} from "@/lore/model";
import {
  buildModuleResolutionIndex,
  isRelativeSpecifier,
} from "./module-resolution";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

type FunctionLike =
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

interface CollectedCallable {
  node: FunctionLike;
  signature: CallableSignature;
}

/** Every named function declaration (including nested ones), named class method, and named arrow/function-expression in a file. Overload signatures and abstract method declarations (no body) are excluded — only the implementation is a real callable. */
function collectCallables(
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

    const location: SourceLocation = {
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

/** The nearest enclosing tracked callable for a call expression, or undefined if the call sits at module scope or inside an untracked (anonymous) function. */
function enclosingCallable(
  callExpr: Node,
  byNode: Map<Node, CollectedCallable>
): CollectedCallable | undefined {
  const ancestor = callExpr.getFirstAncestor((a) => byNode.has(a));
  return ancestor ? byNode.get(ancestor) : undefined;
}

/** Locally-bound names imported via a *named* (not default) relative import in this file, mapped to the resolved target file and the name they're bound to there. Default imports are out of scope (ADR-0012) — matching a default export back to a specific callable would need import/export-shape handling this version doesn't attempt. */
function namedRelativeImports(
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

export interface CallGraphExtraction {
  callableSignatures: CallableSignature[];
  callEdges: CallEdge[];
}

export function extractCallGraph(
  sourceFiles: SourceFile[],
  rootDir: string
): CallGraphExtraction {
  let callableCount = 0;
  let edgeCount = 0;
  const callableSignatures: CallableSignature[] = [];
  const callEdges: CallEdge[] = [];

  const byNodePerFile = new Map<string, Map<Node, CollectedCallable>>();
  const byNameInFile = new Map<string, Map<string, CollectedCallable[]>>();

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const collected = collectCallables(
      sourceFile,
      rootDir,
      () => `js-ts-callable-${++callableCount}`
    );

    byNodePerFile.set(
      filePath,
      new Map(collected.map((c) => [c.node as Node, c]))
    );

    const nameMap = new Map<string, CollectedCallable[]>();
    for (const c of collected) {
      const list = nameMap.get(c.signature.name) ?? [];
      list.push(c);
      nameMap.set(c.signature.name, list);
    }
    byNameInFile.set(filePath, nameMap);

    callableSignatures.push(...collected.map((c) => c.signature));
  }

  const resolver = buildModuleResolutionIndex(sourceFiles);

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    const byNode = byNodePerFile.get(filePath);
    if (!byNode || byNode.size === 0) continue;

    const imported = namedRelativeImports(sourceFile, rootDir, resolver);

    for (const callExpr of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const expression = callExpr.getExpression();
      if (!Node.isIdentifier(expression)) continue;

      const caller = enclosingCallable(callExpr, byNode);
      if (!caller) continue;

      const calleeName = expression.getText();
      const sameFileMatches = byNameInFile.get(filePath)?.get(calleeName);

      let callee: CollectedCallable | undefined;
      if (sameFileMatches && sameFileMatches.length === 1) {
        callee = sameFileMatches[0];
      } else if (!sameFileMatches || sameFileMatches.length === 0) {
        const target = imported.get(calleeName);
        if (target) {
          const targetMatches = byNameInFile
            .get(target.targetFile)
            ?.get(target.importedName);
          if (targetMatches && targetMatches.length === 1) {
            callee = targetMatches[0];
          }
        }
      }
      if (!callee) continue;

      const callSiteLocation: SourceLocation = {
        filePath,
        startLine: callExpr.getStartLineNumber(),
      };
      edgeCount += 1;
      callEdges.push({
        id: `js-ts-call-${edgeCount}`,
        callerId: caller.signature.id,
        calleeId: callee.signature.id,
        callSiteLocation,
        certainty: "detected",
        evidence: [
          {
            kind: "call-expression",
            certainty: "detected",
            location: callSiteLocation,
            description: `'${caller.signature.name}' calls '${callee.signature.name}' in '${filePath}'.`,
          },
        ],
      });
    }
  }

  return { callableSignatures, callEdges };
}
