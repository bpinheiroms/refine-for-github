/* Pauses work while the tab is hidden; resumes with one catch-up call. */
(() => {
  function whileVisible(fn, doc = globalThis.document) {
    let missed = false;
    const wrapped = (...args) => {
      if (doc.hidden) { missed = true; return; }
      fn(...args);
    };
    const onChange = () => {
      if (!doc.hidden && missed) { missed = false; fn(); }
    };
    doc.addEventListener("visibilitychange", onChange);
    wrapped.dispose = () => doc.removeEventListener("visibilitychange", onChange);
    return wrapped;
  }

  const api = { whileVisible };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).visibility = api;
})();
