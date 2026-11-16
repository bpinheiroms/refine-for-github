/* Shortens titles and branch names for the stack header and the panel. */
(() => {
  const ELLIPSIS = "…";

  function truncate(text, max = 60) {
    const s = String(text ?? "");
    if (s.length <= max) return s;
    return s.slice(0, max) + ELLIPSIS;
  }

  // Keeps the end visible: "feat/…/very-long-branch-name"
  function truncateMiddle(text, max = 40) {
    const s = String(text ?? "");
    if (s.length <= max) return s;
    const keep = max - 1;
    const head = Math.ceil(keep / 2);
    const tail = Math.floor(keep / 2);
    return s.slice(0, head) + ELLIPSIS + s.slice(s.length - tail);
  }

  const api = { truncate, truncateMiddle, ELLIPSIS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).truncate = api;
})();
