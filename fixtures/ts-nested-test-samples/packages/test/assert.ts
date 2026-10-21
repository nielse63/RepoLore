export function assertNonEmpty(source: string): void {
  if (source.length === 0) throw new Error("Expected non-empty source");
}
