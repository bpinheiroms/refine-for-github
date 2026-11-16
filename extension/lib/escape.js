/* Escaping helpers for anything we write into the page ourselves.
 * GitHub content (titles, branch names, logins) is user-controlled: it must never
 * reach innerHTML without going through escapeHtml first.
 */
(() => {
  const HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>]/g, (c) => HTML_ENTITIES[c]);
  }

  // For building attribute values: title="${escapeAttr(x)}"
  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const api = { escapeHtml, escapeAttr, escapeRegExp };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).escape = api;
})();
