/* Fast non-cryptographic string hash (djb2), for render signatures:
 * if the signature did not change, the panel is not rebuilt.
 */
(() => {
  function hash(str) {
    let h = 5381;
    const s = String(str);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  const signature = (...parts) => hash(parts.map((p) => JSON.stringify(p)).join("\u0000"));

  const api = { hash, signature };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).hash = api;
})();
