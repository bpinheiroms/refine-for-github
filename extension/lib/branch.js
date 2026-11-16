/* Branch names: stack position ("feat/x-2", "stack/x/3") and display form. */
(() => {
  const STACK_SUFFIX = /^(.*?)[-/](\d+)$/;

  function stackPosition(branch) {
    const m = String(branch ?? "").match(STACK_SUFFIX);
    if (!m) return null;
    return { base: m[1], index: parseInt(m[2]) };
  }

  // "refs/heads/feat/x" → "feat/x"; "owner:feat/x" → "feat/x"
  function normalize(ref) {
    return String(ref ?? "").replace(/^refs\/heads\//, "").replace(/^[^:]+:/, "");
  }

  const isDefault = (branch) => ["main", "master", "trunk", "develop"].includes(normalize(branch));

  const api = { stackPosition, normalize, isDefault };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).branch = api;
})();
