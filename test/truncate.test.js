const test = require("node:test");
const assert = require("node:assert/strict");
const { truncate, truncateMiddle } = require("../extension/lib/truncate.js");

test("short text is untouched", () => {
  assert.equal(truncate("hello", 10), "hello");
  assert.equal(truncateMiddle("hello", 10), "hello");
});

test("truncate adds an ellipsis", () => {
  assert.ok(truncate("a".repeat(100), 10).endsWith("…"));
});

test("truncateMiddle keeps both ends", () => {
  const out = truncateMiddle("feat/some-very-long-branch-name", 15);
  assert.equal(out.length, 15);
  assert.ok(out.startsWith("feat/s"));
  assert.ok(out.endsWith("-name"));
});
