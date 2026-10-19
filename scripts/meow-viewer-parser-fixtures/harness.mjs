import assert from "node:assert/strict";

export const now = 1780260000000;

export function textOf(result) {
  return result.segments.map((segment) => segment.text).join("\n\n");
}

export function assertNoLeak(text, forbidden) {
  for (const value of forbidden) {
    assert.equal(text.includes(value), false, `parser leaked ${value}`);
  }
}
