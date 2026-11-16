const test = require("node:test");
const assert = require("node:assert/strict");
const { uid, reset } = require("../extension/lib/id.js");

test("uid is unique and prefixed", () => {
  reset();
  const a = uid(), b = uid("panel");
  assert.equal(a, "gr-1");
  assert.equal(b, "panel-2");
});
