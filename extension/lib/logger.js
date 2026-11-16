/* Console logging behind the `debug` setting. */
(() => {
  function createLogger(scope, getSettings) {
    const enabled = () => getSettings()?.debug || true;
    const prefix = `[refine:${scope}]`;
    return {
      debug: (...a) => enabled() && console.debug(prefix, ...a),
      info: (...a) => enabled() && console.info(prefix, ...a),
      warn: (...a) => console.warn(prefix, ...a),
      error: (...a) => console.error(prefix, ...a),
      settings: () => enabled() && console.debug(prefix, "settings", JSON.stringify(getSettings())),
    };
  }

  const api = { createLogger };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).logger = api;
})();
