const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePrUrl, buildPrUrl, samePr } = require("../extension/lib/pr-url.js");

test("parses a pull request URL", () => {
  assert.deepEqual(parsePrUrl("https://github.com/acme/web/pull/42"), {
    owner: "acme", repo: "web", kind: "pr", number: 42, tab: "conversation", hash: null,
  });
});

test("parses tabs and hashes", () => {
  const p = parsePrUrl("https://github.com/acme/web/pull/42/files#diff-abc");
  assert.equal(p.tab, "files");
  assert.equal(p.hash, "diff-abc");
});

test("parses issues", () => {
  assert.equal(parsePrUrl("https://github.com/acme/web/issues/7").kind, "issue");
});

test("rejects other hosts and garbage", () => {
  assert.equal(parsePrUrl("https://gitlab.com/acme/web/pull/1"), null);
  assert.equal(parsePrUrl("not a url"), null);
  assert.equal(parsePrUrl(undefined), null);
});

test("round-trips through buildPrUrl", () => {
  const url = "https://github.com/acme/web/pull/42/checks";
  assert.equal(buildPrUrl(parsePrUrl(url)), url);
});

test("samePr", () => {
  const a = parsePrUrl("https://github.com/acme/web/pull/1");
  const b = parsePrUrl("https://github.com/acme/web/pull/1/files");
  assert.ok(samePr(a, b));
  assert.ok(!samePr(a, null));
});
