const test = require("node:test");
const assert = require("node:assert/strict");
const { compact, percent } = require("../extension/lib/number-format.js");

test("compact", () => {
  assert.equal(compact(950), "950");
  assert.equal(compact(1200), "1.2k");
  assert.equal(compact(34000), "34k");
  assert.equal(compact(1_500_000), "1.5M");
  assert.equal(compact(-2000), "-2k");
  assert.equal(compact(NaN), "");
});

test("percent", () => {
  assert.equal(percent(1, 4), "25%");
  assert.equal(percent(1, 3, 1), "33.3%");
});
