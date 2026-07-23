import test from "node:test";
import assert from "node:assert/strict";
import { add, multiply, divide } from "./math";

test("add sums two numbers", () => {
  assert.equal(add(2, 3), 5);
});

test("multiply multiplies two numbers", () => {
  assert.equal(multiply(2, 3), 6);
});

test("divide rounds to the given precision", () => {
  assert.equal(divide(10, 3, 2), 3.33);
});
