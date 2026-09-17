const SUFFIX_POOL_SIZE = 256;

/**
 * Generated once at module load, not per render/call — regenerating a
 * random suffix on every render would give every list item a new `key` each
 * time, making React discard and remount the whole list instead of
 * reconciling it (see https://react.dev/learn/rendering-lists#rules-of-keys).
 * A fixed pool keeps `listItemKey` stable across re-renders while still
 * appending a random alphanumeric component to the index.
 */
const SUFFIX_POOL = Array.from({ length: SUFFIX_POOL_SIZE }, () =>
  Math.random().toString(36).slice(2, 10)
);

/** Builds a `{index}-{randomAlphanumeric}` React key: unique per index within a list, stable across re-renders. */
export function listItemKey(index: number): string {
  return `${index}-${SUFFIX_POOL[index % SUFFIX_POOL_SIZE]}`;
}
