const test = require("node:test");
const assert = require("node:assert/strict");
const { hash, signature } = require("../extension/lib/hash.js");

test("hash is stable", () => {
  assert.equal(hash("abc"), hash("abc"));
  assert.notEqual(hash("abc"), hash("abd"));
});

test("signature distinguishes argument boundaries", () => {
  assert.notEqual(signature("ab", "c"), signature("a", "bc"));
});
