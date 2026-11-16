import {
  initialInspectorState,
  inspectorReducer,
  nextInspectorOpener,
} from "../inspector-state";

describe("initialInspectorState", () => {
  it("starts closed with no selection", () => {
    expect(initialInspectorState()).toEqual({
      selectedId: undefined,
      open: false,
    });
  });

  it("starts closed even with an initial selection", () => {
    expect(initialInspectorState("top")).toEqual({
      selectedId: "top",
      open: false,
    });
  });
});

describe("inspectorReducer", () => {
  it("opens the inspector on selection", () => {
    expect(
      inspectorReducer(initialInspectorState<string>(), {
        type: "select",
        id: "a",
      })
    ).toEqual({ selectedId: "a", open: true });
  });

  it("switches the selection while open", () => {
    expect(
      inspectorReducer(
        { selectedId: "a", open: true },
        { type: "select", id: "b" }
      )
    ).toEqual({ selectedId: "b", open: true });
  });

  it("re-opens on selecting the item that was last inspected", () => {
    expect(
      inspectorReducer(
        { selectedId: "a", open: false },
        { type: "select", id: "a" }
      )
    ).toEqual({ selectedId: "a", open: true });
  });

  it("closes without clearing the selection", () => {
    expect(
      inspectorReducer({ selectedId: "a", open: true }, { type: "close" })
    ).toEqual({ selectedId: "a", open: false });
  });

  it("returns the same state when closing an already closed inspector", () => {
    const state = { selectedId: "a", open: false };
    expect(inspectorReducer(state, { type: "close" })).toBe(state);
  });
});

describe("nextInspectorOpener", () => {
  class Node {
    constructor(readonly children: Node[] = []) {}
    contains(other: Node): boolean {
      return (
        other === this || this.children.some((child) => child.contains(other))
      );
    }
  }

  const row = new Node();
  const otherRow = new Node();
  const callerLink = new Node();
  const inspector = new Node([callerLink]);

  it("remembers the trigger outside the inspector", () => {
    expect(nextInspectorOpener(null, row, null)).toBe(row);
  });

  it("replaces the opener when another item outside the inspector is selected", () => {
    expect(nextInspectorOpener(row, otherRow, inspector)).toBe(otherRow);
  });

  it("keeps the original opener for selections made inside the inspector", () => {
    expect(nextInspectorOpener(row, callerLink, inspector)).toBe(row);
  });

  it("keeps the current opener when there is no trigger", () => {
    expect(nextInspectorOpener(row, null, inspector)).toBe(row);
  });
});
