/* Heading ids for the description's table of contents. */
(() => {
  function slugify(text) {
    return String(text ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  // One id per heading, in document order.
  function slugsFor(headings) {
    return headings.map((h) => `gr-${slugify(h)}`);
  }

  const api = { slugify, slugsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).slug = api;
})();
