const test = require("node:test");
const assert = require("node:assert/strict");
const { slugify, slugsFor } = require("../extension/lib/slug.js");

test("slugify", () => {
  assert.equal(slugify("How to test"), "how-to-test");
  assert.equal(slugify("  Café & crème! "), "cafe-creme");
  assert.equal(slugify(null), "");
});

test("slugsFor prefixes ids", () => {
  assert.deepEqual(slugsFor(["Summary", "Test plan"]), ["gr-summary", "gr-test-plan"]);
});
