/* Tiny pub/sub between the content script, the cockpit and the panel. */
(() => {
  function createBus() {
    const listeners = new Map();

    function on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
      return () => off(type, fn);
    }

    function off(type, fn) {
      const list = listeners.get(type);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i !== -1) list.splice(i, 1);
    }

    function once(type, fn) {
      const unsubscribe = on(type, (payload) => {
        unsubscribe();
        fn(payload);
      });
      return unsubscribe;
    }

    function emit(type, payload) {
      const list = listeners.get(type);
      if (!list) return 0;
      list.forEach((fn) => fn(payload));
      return list.length;
    }

    return { on, off, once, emit };
  }

  const api = { createBus };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).bus = api;
})();
