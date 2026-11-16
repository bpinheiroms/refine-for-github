const test = require("node:test");
const assert = require("node:assert/strict");
const { hexToRgb, contrast, textOn } = require("../extension/lib/color.js");

test("hexToRgb", () => {
  assert.deepEqual(hexToRgb("#ff8000"), { r: 255, g: 128, b: 0 });
  assert.equal(hexToRgb("nope"), null);
});

test("contrast of black on white is 21", () => {
  assert.equal(Math.round(contrast("#ffffff", "#000000")), 21);
});

test("textOn", () => {
  assert.equal(textOn("#ffffff"), "#000000");
  assert.equal(textOn("#f6f8fa"), "#000000");
});
