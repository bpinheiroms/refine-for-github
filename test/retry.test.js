const test = require("node:test");
const assert = require("node:assert/strict");
const { retry } = require("../extension/lib/retry.js");

test("returns the first success", async () => {
  assert.equal(await retry(async () => 7), 7);
});

test("succeeds after a transient failure", async () => {
  let n = 0;
  const value = await retry(async () => {
    if (n++ === 0) throw new Error("quota");
    return "ok";
  }, { base: 1 });
  assert.equal(value, "ok");
});

test("does not retry when shouldRetry says no", async () => {
  let n = 0;
  await assert.rejects(retry(async () => { n++; throw new Error("fatal"); }, { shouldRetry: () => false }));
  assert.equal(n, 1);
});
