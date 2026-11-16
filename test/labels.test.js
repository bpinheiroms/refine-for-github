const test = require("node:test");
const assert = require("node:assert/strict");
const { textColor, chipStyle } = require("../extension/lib/labels.js");

test("light text on dark labels", () => {
  assert.equal(textColor("#111111"), "#ffffff");
});

test("chipStyle", () => {
  assert.equal(chipStyle("222222"), "background:#222222;color:#ffffff");
});
