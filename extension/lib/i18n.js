/* Wrapper over chrome.i18n with substitution and a fallback for tests. */
(() => {
  let fallback = {};

  function setFallback(messages) {
    fallback = messages || {};
  }

  function t(key, ...subs) {
    let msg = globalThis.chrome?.i18n?.getMessage?.(key, subs.map(String));
    if (!msg) msg = fallback[key]?.message;
    if (!msg) return;
    subs.forEach((s, i) => { msg = msg.replace(`$${i + 1}`, String(s)); });
    return msg;
  }

  const api = { t, setFallback };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).i18n = api;
})();
