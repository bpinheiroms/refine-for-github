const test = require("node:test");
const assert = require("node:assert/strict");
const { deepMerge, withDefaults } = require("../extension/lib/deep-merge.js");

test("merges nested objects", () => {
  const out = deepMerge({ a: 1, n: { x: 1, y: 2 } }, { n: { y: 3 } }, { b: 2 });
  assert.deepEqual(out, { a: 1, b: 2, n: { x: 1, y: 3 } });
});

test("ignores undefined values", () => {
  assert.deepEqual(deepMerge({ a: 1 }, { a: undefined }), { a: 1 });
});

test("arrays are replaced, not merged", () => {
  assert.deepEqual(deepMerge({ a: [1, 2] }, { a: [3] }), { a: [3] });
});

test("withDefaults fills missing keys", () => {
  const s = withDefaults({ enabled: true, accent: "violet" }, { accent: "blue" });
  assert.equal(s.accent, "blue");
  assert.equal(s.enabled, true);
});
