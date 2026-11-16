const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCombo, bindShortcuts } = require("../extension/lib/shortcuts.js");

const key = (k, mods = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, preventDefault() {}, ...mods,
});

function fakeTarget() {
  let handler = null;
  return {
    addEventListener: (_, fn) => { handler = fn; },
    removeEventListener: () => { handler = null; },
    press: (e) => handler?.(e),
  };
}

test("parseCombo", () => {
  assert.deepEqual(parseCombo("ctrl+k"), [{ key: "k", ctrl: true, meta: false, alt: false, shift: false }]);
  assert.equal(parseCombo("g o").length, 2);
});

test("sequence shortcut fires", () => {
  const target = fakeTarget();
  let fired = 0;
  bindShortcuts(target, { "g o": () => fired++ });
  target.press(key("g"));
  target.press(key("o"));
  assert.equal(fired, 1);
});

test("unbind", () => {
  const target = fakeTarget();
  let fired = 0;
  const off = bindShortcuts(target, { "]": () => fired++ });
  off();
  target.press(key("]"));
  assert.equal(fired, 0);
});
