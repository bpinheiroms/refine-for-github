/* Minimal semver comparison, for the "what's new" toast after an update.
 * Only x.y.z (no pre-release tags): that is all the manifest allows.
 */
(() => {
  const VERSION = /^\d+\.\d+\.\d+$/;

  function parse(v) {
    if (!VERSION.test(String(v))) return null;
    return String(v).split(".");
  }

  // -1 if a < b, 0 if equal, 1 if a > b
  function compare(a, b) {
    const pa = parse(a), pb = parse(b);
    if (!pa || !pb) throw new TypeError(`invalid version: ${!pa ? a : b}`);
    for (let i = 0; i < 3; i++) {
      if (pa[i] > pb[i]) return 1;
      if (pa[i] < pb[i]) return -1;
    }
    return 0;
  }

  const isNewer = (a, b) => compare(a, b) > 0;
  const isValid = (v) => parse(v) !== null;

  const api = { compare, isNewer, isValid };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).semver = api;
})();
