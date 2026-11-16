const test = require("node:test");
const assert = require("node:assert/strict");
const { rollup, failing, summary } = require("../extension/lib/checks.js");

test("rollup of nothing", () => {
  assert.equal(rollup([]), "none");
});

test("rollup failure", () => {
  assert.equal(rollup([{ name: "lint", state: "failure" }, { name: "test", state: "success" }]), "failure");
});

test("rollup pending", () => {
  assert.equal(rollup([{ name: "a", state: "queued" }]), "pending");
});

test("failing names", () => {
  assert.deepEqual(failing([{ name: "a", state: "error" }, { name: "b", state: "success" }]), ["a"]);
});

test("summary counts", () => {
  assert.deepEqual(summary([
    { name: "a", state: "success" }, { name: "b", state: "failure" }, { name: "c", state: "pending" },
  ]), { success: 1, failure: 1, pending: 1 });
});
