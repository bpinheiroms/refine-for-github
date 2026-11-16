const test = require("node:test");
const assert = require("node:assert/strict");
const { parseQuery, stringify, has } = require("../extension/lib/filter-query.js");

test("parses qualifiers and text", () => {
  const q = parseQuery("is:open author:ana fix login");
  assert.deepEqual(q.qualifiers, { is: ["open"], author: ["ana"] });
  assert.deepEqual(q.text, ["fix", "login"]);
});

test("negated qualifiers", () => {
  assert.deepEqual(parseQuery("-label:wip").negated, { label: ["wip"] });
});

test("has", () => {
  assert.ok(has(parseQuery("is:pr is:open"), "is", "open"));
});

test("stringify round-trip", () => {
  assert.equal(stringify(parseQuery("is:open -label:wip fix")), "is:open -label:wip fix");
});
