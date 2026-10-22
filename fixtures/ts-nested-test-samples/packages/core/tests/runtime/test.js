import { compile } from "../../src/index";

export function runSample(config) {
  return compile(config.input) === config.expected;
}
