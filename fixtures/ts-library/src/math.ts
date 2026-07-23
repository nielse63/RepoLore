import { roundTo } from "./internal/round";

export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number, precision = 2): number {
  return roundTo(a / b, precision);
}
