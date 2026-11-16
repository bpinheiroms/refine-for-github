const test = require("node:test");
const assert = require("node:assert/strict");
const { createQueue } = require("../extension/lib/queue.js");

test("runs jobs and resolves their values", async () => {
  const q = createQueue(2);
  const out = await Promise.all([1, 2, 3].map((n) => q.push(async () => n * 2)));
  assert.deepEqual(out, [2, 4, 6]);
});

test("respects the concurrency limit", async () => {
  const q = createQueue(1);
  let active = 0, peak = 0;
  const job = async () => { active++; peak = Math.max(peak, active); await null; active--; };
  await Promise.all([q.push(job), q.push(job), q.push(job)]);
  assert.equal(peak, 1);
});

test("a failing job rejects its promise", async () => {
  const q = createQueue(2);
  await assert.rejects(q.push(async () => { throw new Error("boom"); }), /boom/);
});
