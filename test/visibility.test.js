const test = require("node:test");
const assert = require("node:assert/strict");
const { whileVisible } = require("../extension/lib/visibility.js");

function fakeDoc() {
  const listeners = new Set();
  return {
    hidden: false,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    fire() { for (const fn of listeners) fn(); },
  };
}

test("runs while visible", () => {
  const doc = fakeDoc();
  let n = 0;
  whileVisible(() => n++, doc)();
  assert.equal(n, 1);
});

test("defers while hidden and catches up once", () => {
  const doc = fakeDoc();
  let n = 0;
  const fn = whileVisible(() => n++, doc);
  doc.hidden = true;
  fn(); fn();
  assert.equal(n, 0);
  doc.hidden = false;
  doc.fire();
  assert.equal(n, 1);
});
