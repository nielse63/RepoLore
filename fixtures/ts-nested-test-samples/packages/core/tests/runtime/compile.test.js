import { normalize } from "./helpers.js";

export function assertCompiles(compiled, expected) {
  return normalize(compiled) === normalize(expected);
}
