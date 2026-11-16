const test = require("node:test");
const assert = require("node:assert/strict");
const { migrate, CURRENT } = require("../extension/lib/settings-migrate.js");

test("empty input gives the current schema", () => {
  assert.deepEqual(migrate(null), { schema: CURRENT });
});

test("v1 compact is split", () => {
  const s = migrate({ schema: 1, compact: false, accent: "blue" });
  assert.equal(s.schema, CURRENT);
  assert.equal(s.accent, "blue");
});

test("purple becomes violet", () => {
  assert.equal(migrate({ schema: 2, accent: "purple" }).accent, "violet");
});

test("current schema is left alone", () => {
  assert.deepEqual(migrate({ schema: CURRENT, enabled: false, accent: "green" }), {
    schema: CURRENT, enabled: false, accent: "green",
  });
});
