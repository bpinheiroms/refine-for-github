const test = require("node:test");
const assert = require("node:assert/strict");
const { TTLCache } = require("../extension/lib/cache-ttl.js");

test("returns cached values", () => {
  const c = new TTLCache(60, () => 0);
  c.set("a", 1);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("missing"), undefined);
});

test("getOrLoad loads once", async () => {
  const c = new TTLCache(60, () => 0);
  let loads = 0;
  const load = async () => { loads++; return "v"; };
  assert.equal(await c.getOrLoad("k", load), "v");
  assert.equal(await c.getOrLoad("k", load), "v");
  assert.equal(loads, 1);
});
