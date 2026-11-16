const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeHtml, escapeRegExp } = require("../extension/lib/escape.js");

test("escapeHtml escapes markup", () => {
  assert.equal(escapeHtml("<b>a & b</b>"), "&lt;b&gt;a &amp; b&lt;/b&gt;");
});

test("escapeHtml handles null and numbers", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(42), "42");
});

test("escapeRegExp makes a literal pattern", () => {
  assert.ok(new RegExp(escapeRegExp("a.b*c")).test("a.b*c"));
  assert.ok(!new RegExp(escapeRegExp("a.b")).test("axb"));
});
