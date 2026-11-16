const test = require("node:test");
const assert = require("node:assert/strict");
const { LRU } = require("../extension/lib/lru.js");

test("evicts the oldest entry", () => {
  const c = new LRU(2);
  c.set("a", 1).set("b", 2).set("c", 3);
  assert.equal(c.has("a"), false);
  assert.equal(c.get("c"), 3);
  assert.equal(c.size, 2);
});

test("re-setting a key refreshes it", () => {
  const c = new LRU(2);
  c.set("a", 1).set("b", 2).set("a", 10).set("c", 3);
  assert.equal(c.get("a"), 10);
  assert.equal(c.has("b"), false);
});

test("rejects invalid sizes", () => {
  assert.throws(() => new LRU(0), RangeError);
});
