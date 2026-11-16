const test = require("node:test");
const assert = require("node:assert/strict");
const { buildToc, flatten } = require("../extension/lib/markdown-toc.js");

const h = (level, text) => ({ level, text, id: text.toLowerCase() });

test("nests by level", () => {
  const toc = buildToc([h(2, "Summary"), h(3, "Why"), h(3, "How"), h(2, "Tests")]);
  assert.equal(toc.length, 2);
  assert.deepEqual(toc[0].children.map((n) => n.text), ["Why", "How"]);
});

test("flatten gives depths", () => {
  const flat = flatten(buildToc([h(2, "A"), h(3, "B"), h(2, "C")]));
  assert.deepEqual(flat.map((n) => n.depth), [0, 1, 0]);
});
