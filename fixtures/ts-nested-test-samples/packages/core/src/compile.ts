import { assertNonEmpty } from "../../test/assert";

export function compile(source: string): string {
  assertNonEmpty(source);
  return source.trim();
}
