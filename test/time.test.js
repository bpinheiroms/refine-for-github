const test = require("node:test");
const assert = require("node:assert/strict");
const { relativeTime, formatDuration, isStale, MINUTE, HOUR, DAY } = require("../extension/lib/time.js");

const now = Date.UTC(2026, 10, 16, 12, 0, 0);

test("relativeTime buckets", () => {
  assert.equal(relativeTime(now - 10 * 1000, now), "just now");
  assert.equal(relativeTime(now - MINUTE, now), "1 minute ago");
  assert.equal(relativeTime(now - 5 * MINUTE, now), "5 minutes ago");
  assert.equal(relativeTime(now - 3 * HOUR, now), "3 hours ago");
  assert.equal(relativeTime(now - 30 * HOUR, now), "yesterday");
  assert.equal(relativeTime(now - 4 * DAY, now), "4 days ago");
  assert.equal(relativeTime(now - 400 * DAY, now), "1 year ago");
});

test("relativeTime ignores invalid dates", () => {
  assert.equal(relativeTime("nope", now), "");
});

test("formatDuration", () => {
  assert.equal(formatDuration(45 * 1000), "45s");
  assert.equal(formatDuration(125 * 1000), "2m 5s");
  assert.equal(formatDuration(HOUR + 4 * MINUTE), "1h 4m");
  assert.equal(formatDuration(-1), "");
});

test("isStale", () => {
  assert.equal(isStale(now - 20 * DAY, 14, now), true);
  assert.equal(isStale(now - 2 * DAY, 14, now), false);
});
