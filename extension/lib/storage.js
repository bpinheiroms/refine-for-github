/* chrome.storage.sync with an in-memory cache and change subscription. */
(() => {
  let cache = null;
  const subscribers = new Set();

  async function load(defaults) {
    if (cache) return cache;
    const saved = await chrome.storage.sync.get(defaults);
    cache = saved;
    return cache;
  }

  async function save(patch) {
    Object.assign(cache, patch);
    try {
      await chrome.storage.sync.set(patch);
    } catch {}
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  if (globalThis.chrome?.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      const patch = {};
      for (const [k, { newValue }] of Object.entries(changes)) patch[k] = newValue;
      cache = { ...cache, ...patch };
      for (const fn of subscribers) fn(cache, patch);
    });
  }

  const api = { load, save, subscribe };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).storage = api;
})();
