/* Compact numbers for diffstats and counters: 950, 1.2k, 34k, 1.5M. */
(() => {
  function compact(n) {
    if (!Number.isFinite(n)) return "";
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs < 1000) return sign + String(abs);
    if (abs < 1_000_000) return sign + trim((abs / 1000).toFixed(1)) + "k";
    return sign + trim((abs / 1_000_000).toFixed(1)) + "M";
  }

  const trim = (s) => s.replace(/\.0$/, "");

  function percent(part, total, digits = 0) {
    return `${(part / total * 100).toFixed(digits)}%`;
  }

  const api = { compact, percent };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).number = api;
})();
