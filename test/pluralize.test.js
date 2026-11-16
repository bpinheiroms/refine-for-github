const test = require("node:test");
const assert = require("node:assert/strict");
const { plural, count, list } = require("../extension/lib/pluralize.js");

test("plural", () => {
  assert.equal(plural("check", 1), "check");
  assert.equal(plural("check", 2), "checks");
  assert.equal(plural("reply", 3), "replies");
  assert.equal(plural("branch", 2), "branches");
  assert.equal(plural("day", 2), "days");
  assert.equal(plural("dependency", 2), "dependencies");
});

test("count", () => {
  assert.equal(count(0, "comment"), "0 comments");
});

test("list", () => {
  assert.equal(list([]), "");
  assert.equal(list(["a"]), "a");
  assert.equal(list(["a", "b"]), "a and b");
  assert.equal(list(["a", "b", "c"], "or"), "a, b, or c");
});
