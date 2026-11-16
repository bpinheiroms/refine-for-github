const test = require("node:test");
const assert = require("node:assert/strict");
const { copy } = require("../extension/lib/clipboard.js");

test("copy writes to the clipboard", () => {
  const written = [];
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async (s) => { written.push(s); } } },
    configurable: true,
  });
  assert.equal(copy("#42"), true);
  assert.deepEqual(written, ["#42"]);
});
