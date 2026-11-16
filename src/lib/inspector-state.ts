/**
 * Selection and inspector visibility for a Lore page (issue #84). They're
 * separate: a page can have a selection while the inspector is closed (Data
 * Flow focuses its top-ranked function on load), and closing the inspector
 * keeps the selection so the page still shows what was last inspected.
 * Only an explicit selection opens the inspector.
 */
export interface InspectorState<Id> {
  selectedId: Id | undefined;
  open: boolean;
}

export type InspectorAction<Id> =
  { type: "select"; id: Id } | { type: "close" };

export function initialInspectorState<Id>(selectedId?: Id): InspectorState<Id> {
  return { selectedId, open: false };
}

export function inspectorReducer<Id>(
  state: InspectorState<Id>,
  action: InspectorAction<Id>
): InspectorState<Id> {
  switch (action.type) {
    case "select":
      return { selectedId: action.id, open: true };
    case "close":
      return state.open ? { ...state, open: false } : state;
  }
}

/**
 * Which element focus should return to when the inspector closes. A
 * selection made from inside the inspector (e.g. following a caller link)
 * keeps the original opener, since the inspector itself is what's closing;
 * any other trigger becomes the new opener.
 */
export function nextInspectorOpener<T extends { contains(other: T): boolean }>(
  current: T | null,
  trigger: T | null,
  inspector: T | null
): T | null {
  if (!trigger) return current;
  if (inspector?.contains(trigger)) return current;
  return trigger;
}
