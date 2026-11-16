/* Merges saved settings over the defaults (nested objects included). */
(() => {
  const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

  function deepMerge(target, ...sources) {
    for (const source of sources) {
      if (!isObject(source)) continue;
      for (const key of Object.keys(source)) {
        const value = source[key];
        if (isObject(value)) {
          if (!isObject(target[key])) target[key] = {};
          deepMerge(target[key], value);
        } else if (value !== undefined) {
          target[key] = value;
        }
      }
    }
    return target;
  }

  // Settings = defaults + what the user saved.
  const withDefaults = (defaults, saved) => deepMerge(defaults, saved);

  const api = { deepMerge, withDefaults, isObject };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).merge = api;
})();
