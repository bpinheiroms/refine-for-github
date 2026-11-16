const test = require("node:test");
const assert = require("node:assert/strict");
const { t, setFallback } = require("../extension/lib/i18n.js");
const en = require("../extension/_locales/en/messages.json");

test("reads the fallback messages", () => {
  setFallback(en);
  assert.equal(t("popupEnabled"), en.popupEnabled.message);
});

test("substitutes placeholders", () => {
  setFallback({ greet: { message: "Hi $1, you have $2 PRs" } });
  assert.equal(t("greet", "ana", 3), "Hi ana, you have 3 PRs");
});
