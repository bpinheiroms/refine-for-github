const test = require("node:test");
const assert = require("node:assert/strict");
const { orderStack, positionOf } = require("../extension/lib/stack-graph.js");

const prs = [
  { number: 12, head: "feat/x-3", base: "feat/x-2" },
  { number: 10, head: "feat/x-1", base: "main" },
  { number: 11, head: "feat/x-2", base: "feat/x-1" },
];

test("orders bottom to top", () => {
  assert.deepEqual(orderStack(prs).map((p) => p.number), [10, 11, 12]);
});

test("positionOf is 1-based", () => {
  assert.equal(positionOf(orderStack(prs), 12), 3);
  assert.equal(positionOf(orderStack(prs), 99), 0);
});
