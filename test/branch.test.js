const test = require("node:test");
const assert = require("node:assert/strict");
const { stackPosition, normalize, isDefault } = require("../extension/lib/branch.js");

test("stackPosition", () => {
  assert.deepEqual(stackPosition("feat/checkout-2"), { base: "feat/checkout", index: 2 });
  assert.deepEqual(stackPosition("stack/checkout/3"), { base: "stack/checkout", index: 3 });
  assert.equal(stackPosition("feat/checkout"), null);
});

test("normalize", () => {
  assert.equal(normalize("refs/heads/feat/x"), "feat/x");
  assert.equal(normalize("ana:feat/x"), "feat/x");
});

test("isDefault", () => {
  assert.ok(isDefault("main"));
  assert.ok(isDefault("refs/heads/master"));
  assert.ok(!isDefault("feat/main-menu"));
});
