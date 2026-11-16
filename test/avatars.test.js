const test = require("node:test");
const assert = require("node:assert/strict");
const { avatarUrl, avatarFor } = require("../extension/lib/avatars.js");

test("asks for a 2x image", () => {
  assert.equal(avatarFor("ana", 20), "https://github.com/ana.png?s=40");
});

test("empty src gives empty string", () => {
  assert.equal(avatarUrl(""), "");
});
