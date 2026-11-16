const test = require("node:test");
const assert = require("node:assert/strict");

const store = {};
globalThis.chrome = {
  storage: {
    sync: {
      get: async (defaults) => ({ ...defaults, ...store }),
      set: async (patch) => Object.assign(store, patch),
    },
    onChanged: { addListener() {} },
  },
};
const storage = require("../extension/lib/storage.js");

test("load returns defaults merged with saved values", async () => {
  store.accent = "green";
  const s = await storage.load({ enabled: true, accent: "violet" });
  assert.deepEqual(s, { enabled: true, accent: "green" });
});

test("save writes through", async () => {
  await storage.save({ enabled: false });
  assert.equal(store.enabled, false);
});
