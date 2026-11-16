const test = require("node:test");
const assert = require("node:assert/strict");
const { byNumber, byUpdatedDesc, threadsForPanel, stableSort } = require("../extension/lib/sort.js");

test("byNumber", () => {
  assert.deepEqual([{ number: 3 }, { number: 1 }].sort(byNumber).map((p) => p.number), [1, 3]);
});

test("byUpdatedDesc", () => {
  const out = [{ updated: "2026-01-01" }, { updated: "2026-02-01" }].sort(byUpdatedDesc);
  assert.equal(out[0].updated, "2026-02-01");
});

test("threadsForPanel puts unresolved first", () => {
  const out = threadsForPanel([
    { index: 0, resolved: true }, { index: 1, resolved: false }, { index: 2, resolved: false },
  ]);
  assert.deepEqual(out.map((t) => t.index), [1, 2, 0]);
});

test("stableSort keeps ties in order", () => {
  const out = stableSort([{ k: 1, id: "a" }, { k: 0, id: "b" }, { k: 1, id: "c" }], (a, b) => a.k - b.k);
  assert.deepEqual(out.map((x) => x.id), ["b", "a", "c"]);
});
