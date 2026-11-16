const test = require("node:test");
const assert = require("node:assert/strict");
const { daysAgo, within, startOfDay } = require("../extension/lib/date-range.js");

test("startOfDay", () => {
  const d = startOfDay(new Date(2026, 10, 16, 15, 30));
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

test("daysAgo", () => {
  const d = daysAgo(3, new Date(2026, 10, 16, 15, 30));
  assert.equal(d.getDate(), 13);
});

test("within", () => {
  assert.ok(within(new Date(2026, 10, 15), 7, new Date(2026, 10, 16)));
  assert.ok(!within(new Date(2026, 9, 1), 7, new Date(2026, 10, 16)));
});
