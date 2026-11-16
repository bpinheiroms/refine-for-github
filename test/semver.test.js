const test = require("node:test");
const assert = require("node:assert/strict");
const { compare, isNewer, isValid } = require("../extension/lib/semver.js");

test("compare", () => {
  assert.equal(compare("1.2.0", "1.2.0"), 0);
  assert.equal(compare("1.3.0", "1.2.0"), 1);
  assert.equal(compare("1.2.0", "2.0.0"), -1);
  assert.equal(compare("1.2.1", "1.2.0"), 1);
});

test("isNewer", () => {
  assert.ok(isNewer("1.3.0", "1.2.0"));
  assert.ok(!isNewer("1.2.0", "1.2.0"));
});

test("isValid", () => {
  assert.ok(isValid("1.0.0"));
  assert.ok(!isValid("1.0"));
  assert.ok(!isValid("v1.0.0"));
});

test("compare throws on invalid input", () => {
  assert.throws(() => compare("x", "1.0.0"), TypeError);
});
