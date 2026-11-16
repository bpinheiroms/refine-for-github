const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldShow } = require("../extension/lib/toast.js");

test("not on first install", () => {
  assert.equal(shouldShow("1.3.0", undefined), false);
});

test("after an update", () => {
  assert.equal(shouldShow("1.3.0", "1.2.0"), true);
});

test("not when the version did not change", () => {
  assert.equal(shouldShow("1.3.0", "1.3.0"), false);
});
