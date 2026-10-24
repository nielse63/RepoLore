import { normalize } from "./helpers.js";

export function assertRenders(rendered, expected) {
  return normalize(rendered) === normalize(expected);
}
