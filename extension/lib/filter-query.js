/* Parses GitHub's list search box ("is:open author:me label:"needs review" fix")
 * so the lists can tell which filters are active.
 */
(() => {
  function parseQuery(q) {
    const out = { qualifiers: {}, negated: {}, text: [] };
    for (const token of String(q ?? "").trim().split(/\s+/)) {
      if (!token) continue;
      const m = token.match(/^(-?)([a-z-]+):(.+)$/i);
      if (!m) { out.text.push(token); continue; }
      const [, neg, key, raw] = m;
      const value = raw.replace(/^"|"$/g, "");
      const bucket = neg ? out.negated : out.qualifiers;
      (bucket[key.toLowerCase()] ??= []).push(value);
    }
    return out;
  }

  function stringify({ qualifiers = {}, negated = {}, text = [] }) {
    const quote = (v) => (/\s/.test(v) ? `"${v}"` : v);
    const parts = [];
    for (const [k, vs] of Object.entries(qualifiers)) for (const v of vs) parts.push(`${k}:${quote(v)}`);
    for (const [k, vs] of Object.entries(negated)) for (const v of vs) parts.push(`-${k}:${quote(v)}`);
    return [...parts, ...text].join(" ");
  }

  const has = (parsed, key, value) => (parsed.qualifiers[key] || []).includes(value);

  const api = { parseQuery, stringify, has };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).query = api;
})();
