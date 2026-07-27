/** Small, generic tree-sitter traversal helpers shared across Python extraction modules. */

import type { Node as TSNode } from "web-tree-sitter";

export function descendantsOfType(root: TSNode, type: string): TSNode[] {
  const out: TSNode[] = [];
  function visit(node: TSNode) {
    if (node.type === type) out.push(node);
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) visit(child);
    }
  }
  visit(root);
  return out;
}

export function directChildrenOfType(node: TSNode, type: string): TSNode[] {
  const out: TSNode[] = [];
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child && child.type === type) out.push(child);
  }
  return out;
}

/** 1-indexed source line the node starts on. */
export function lineOf(node: TSNode): number {
  return node.startPosition.row + 1;
}

/**
 * web-tree-sitter constructs a fresh Node wrapper object on every `.parent`/
 * `.child()`/`.rootNode` access, so `===` between two independently-obtained
 * wrappers for the same underlying node is always `false` — use `.equals()`
 * (or this helper) for node identity, never `===`.
 */
export function nodesEqual(
  a: TSNode | null | undefined,
  b: TSNode | null | undefined
): boolean {
  if (!a || !b) return false;
  return a.equals(b);
}

/**
 * True if `node` is a direct top-level statement of `root` (the module),
 * accounting for a decorator wrapping it in a `decorated_definition` node
 * (e.g. `@dataclass` on a top-level class).
 */
export function isTopLevel(node: TSNode, root: TSNode): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (nodesEqual(parent, root)) return true;
  return (
    parent.type === "decorated_definition" && nodesEqual(parent.parent, root)
  );
}

export function isStringLiteral(node: TSNode): boolean {
  return node.type === "string";
}

/** The literal text inside a simple (non-interpolated) string node. */
export function stringLiteralValue(node: TSNode): string {
  const contentNode = directChildrenOfType(node, "string_content")[0];
  return contentNode ? contentNode.text : "";
}
