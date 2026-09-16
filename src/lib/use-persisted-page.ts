"use client";

import { useCallback, useSyncExternalStore } from "react";

function readStoredPage(storageKey: string): number | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredPage(storageKey: string, page: number): void {
  try {
    sessionStorage.setItem(storageKey, String(page));
  } catch {
    // sessionStorage unavailable (private browsing, disabled storage) —
    // pagination still works for this render, it just won't be remembered.
  }
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getServerSnapshot(): number {
  return 1;
}

/**
 * Current page for a paginated list, persisted in `sessionStorage` under
 * `storageKey` so it survives navigating away and back within the same tab
 * without leaking between different keys — callers should scope the key to
 * whatever the list is specific to (e.g. a repository and a section), so
 * switching to a different repository never reuses another repository's
 * saved page. Clamped to `[1, pageCount]` on every read, so a stored page
 * from a larger list never strands the user on an empty page.
 *
 * Reads via `useSyncExternalStore` (server snapshot: page 1) rather than
 * `useState` + a mount effect, since sessionStorage doesn't exist during SSR
 * and this avoids both a hydration mismatch and a synchronous setState-in-
 * effect render cascade.
 */
export function usePersistedPage(
  storageKey: string,
  pageCount: number
): readonly [number, (next: number) => void] {
  const getSnapshot = useCallback(
    () => readStoredPage(storageKey) ?? 1,
    [storageKey]
  );
  const rawPage = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const page = Math.min(rawPage, Math.max(pageCount, 1));

  const setPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 1), Math.max(pageCount, 1));
      writeStoredPage(storageKey, clamped);
      listeners.forEach((listener) => listener());
    },
    [storageKey, pageCount]
  );

  return [page, setPage] as const;
}
