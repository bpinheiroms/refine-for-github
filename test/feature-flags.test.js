const test = require("node:test");
const assert = require("node:assert/strict");
const { isOn, all } = require("../extension/lib/feature-flags.js");

test("unknown flags are off", () => {
  assert.equal(isOn("nope"), false);
});

test("saved value wins over the default", () => {
  assert.equal(isOn("stackGraph", { stackGraph: true }), true);
});

test("all lists every flag", () => {
  assert.deepEqual(Object.keys(all({})).sort(), ["shortcuts", "sizeBadge", "stackGraph", "telemetry"]);
});
