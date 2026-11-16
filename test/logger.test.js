const test = require("node:test");
const assert = require("node:assert/strict");
const { createLogger } = require("../extension/lib/logger.js");

test("warn always logs", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  createLogger("x", () => ({ debug: false })).warn("careful");
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0].arguments[0], "[refine:x]");
});

test("debug logs when debug is on", (t) => {
  const debug = t.mock.method(console, "debug", () => {});
  createLogger("x", () => ({ debug: true })).debug("hi");
  assert.equal(debug.mock.callCount(), 1);
});
