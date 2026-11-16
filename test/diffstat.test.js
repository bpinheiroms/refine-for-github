const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDiffstat, sizeOf, ratio } = require("../extension/lib/diffstat.js");

test("parseDiffstat", () => {
  assert.deepEqual(parseDiffstat("+120 -30"), { additions: 120, deletions: 30 });
  assert.deepEqual(parseDiffstat("+1,204 -9"), { additions: 1204, deletions: 9 });
  assert.deepEqual(parseDiffstat(""), { additions: 0, deletions: 0 });
});

test("sizeOf", () => {
  assert.equal(sizeOf({ additions: 3, deletions: 1 }), "xs");
  assert.equal(sizeOf({ additions: 300, deletions: 10 }), "m");
  assert.equal(sizeOf({ additions: 3000, deletions: 0 }), "xl");
});

test("ratio", () => {
  assert.equal(ratio({ additions: 3, deletions: 1 }), 0.75);
});
