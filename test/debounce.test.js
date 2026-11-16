const test = require("node:test");
const assert = require("node:assert/strict");
const { debounce, throttle } = require("../extension/lib/debounce.js");

test("debounce calls after the wait", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const fn = debounce(() => calls++, 50);
  fn();
  assert.equal(calls, 0);
  t.mock.timers.tick(50);
  assert.equal(calls, 1);
});

test("debounce cancel", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const fn = debounce(() => calls++, 50);
  fn();
  fn.cancel();
  t.mock.timers.tick(100);
  assert.equal(calls, 0);
});

test("throttle calls at most once per window", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 10_000 });
  let calls = 0;
  const fn = throttle(() => calls++, 100);
  fn(); fn(); fn();
  assert.equal(calls, 1);
  t.mock.timers.tick(100);
  assert.equal(calls, 2);
});
