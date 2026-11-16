/* Experimental features, off unless the user opts in from the popup. */
(() => {
  const FLAGS = {
    stackGraph: { default: false, since: "1.3.0" },
    shortcuts: { default: true, since: "1.3.0" },
    telemetry: { default: true, since: "1.3.0" },
    sizeBadge: { default: false, since: "1.3.0" },
  };

  function isOn(name, saved = {}) {
    if (!(name in FLAGS)) return false;
    return saved[name] ?? FLAGS[name].default;
  }

  const all = (saved) => Object.fromEntries(Object.keys(FLAGS).map((k) => [k, isOn(k, saved)]));

  const api = { FLAGS, isOn, all };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).flags = api;
})();
