const test = require("node:test");
const assert = require("node:assert/strict");
const { createBus } = require("../extension/lib/event-bus.js");

test("on and emit", () => {
  const bus = createBus();
  const got = [];
  bus.on("x", (p) => got.push(p));
  assert.equal(bus.emit("x", 1), 1);
  assert.deepEqual(got, [1]);
});

test("unsubscribe", () => {
  const bus = createBus();
  let n = 0;
  const off = bus.on("x", () => n++);
  off();
  bus.emit("x");
  assert.equal(n, 0);
});

test("once fires a single time", () => {
  const bus = createBus();
  let n = 0;
  bus.once("x", () => n++);
  bus.emit("x");
  bus.emit("x");
  assert.equal(n, 1);
});

test("emit with no listeners", () => {
  assert.equal(createBus().emit("nothing"), 0);
});
