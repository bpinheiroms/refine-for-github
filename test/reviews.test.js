const test = require("node:test");
const assert = require("node:assert/strict");
const { latestByReviewer, decision } = require("../extension/lib/reviews.js");

test("comments do not count", () => {
  const m = latestByReviewer([{ login: "ana", state: "COMMENTED", at: "2026-01-01" }]);
  assert.equal(m.size, 0);
});

test("one approval is enough by default", () => {
  assert.equal(decision([{ login: "ana", state: "APPROVED", at: "2026-01-01" }]), "approved");
});

test("changes requested wins", () => {
  assert.equal(decision([
    { login: "ana", state: "APPROVED", at: "2026-01-01" },
    { login: "bo", state: "CHANGES_REQUESTED", at: "2026-01-02" },
  ]), "changes_requested");
});

test("review required when short of approvals", () => {
  assert.equal(decision([{ login: "ana", state: "APPROVED", at: "2026-01-01" }], 2), "review_required");
});
