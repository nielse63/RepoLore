/**
 * Confidently-detected React components (ADR-0003): JSX-returning functions
 * and class components extending `React.Component`/`Component`. Framework
 * detection is enrichment within JS/TS analysis, not a separate analyzer.
 */

import path from "node:path";
import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type ClassDeclaration,
  type SourceFile,
} from "ts-morph";
import type { Evidence, SourceLocation } from "@/lore/model";

function toRelative(rootDir: string, absoluteFilePath: string): string {
  return path.relative(rootDir, absoluteFilePath).split(path.sep).join("/");
}

function containsJsx(node: {
  getDescendantsOfKind: (kind: SyntaxKind) => unknown[];
}): boolean {
  return (
    node.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    node.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

/**
 * The declared name of a function-like component: its own name for a
 * function declaration, or the name of the variable/property it's assigned
 * to for an arrow function or function expression (e.g. `const Footer = () => ...`).
 */
function componentName(
  fn: FunctionDeclaration | FunctionExpression | ArrowFunction,
): string {
  if ("getName" in fn && fn.getName()) return fn.getName() as string;

  const parent = fn.getParent();
  if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) {
    return parent.getName();
  }
  return "<anonymous>";
}

function extendsReactComponent(classDecl: ClassDeclaration): boolean {
  const extendsExpr = classDecl.getExtends();
  if (!extendsExpr) return false;
  const text = extendsExpr.getText();
  // Matches "Component", "React.Component", "PureComponent", "React.PureComponent",
  // including generic type arguments, e.g. "Component<Props>".
  return /^(React\.)?(Pure)?Component(<.*>)?$/.test(text);
}

export interface DetectedReactComponent {
  name: string;
  location: SourceLocation;
  evidence: Evidence;
}

export function detectReactComponents(
  sourceFiles: SourceFile[],
  rootDir: string,
): DetectedReactComponent[] {
  const components: DetectedReactComponent[] = [];

  for (const sourceFile of sourceFiles) {
    const filePath = toRelative(rootDir, sourceFile.getFilePath());
    if (!/\.(tsx|jsx)$/.test(filePath)) continue;

    const functionLikes: (
      | FunctionDeclaration
      | FunctionExpression
      | ArrowFunction
    )[] = [
      ...sourceFile.getFunctions(),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ];

    for (const fn of functionLikes) {
      if (!containsJsx(fn)) continue;

      const name = componentName(fn);

      components.push({
        name,
        location: { filePath, symbolName: name, startLine: fn.getStartLineNumber() },
        evidence: {
          kind: "jsx-returning-function",
          certainty: "detected",
          location: { filePath, symbolName: name },
          description: `'${name}' in '${filePath}' returns JSX.`,
        },
      });
    }

    for (const classDecl of sourceFile.getClasses()) {
      if (!extendsReactComponent(classDecl)) continue;

      const name = classDecl.getName() ?? "<anonymous>";
      components.push({
        name,
        location: { filePath, symbolName: name, startLine: classDecl.getStartLineNumber() },
        evidence: {
          kind: "react-class-component",
          certainty: "detected",
          location: { filePath, symbolName: name },
          description: `'${name}' in '${filePath}' extends React's Component/PureComponent.`,
        },
      });
    }
  }

  return components;
}
