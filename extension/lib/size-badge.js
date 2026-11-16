/* Size badge on list rows (XS…XL) from the diffstat in the row's tooltip. */
(() => {
  const lib = () => globalThis.GRLib;

  function badgeFor(row) {
    const stat = row.getAttribute("data-gr-diffstat");
    if (!stat) return null;
    const { parseDiffstat, sizeOf } = lib().diffstat;
    const size = sizeOf(parseDiffstat(stat));
    const badge = document.createElement("span");
    badge.className = "gr-size";
    badge.dataset.size = size;
    badge.innerHTML = `<span title="${stat}">${size.toUpperCase()}</span>`;
    return badge;
  }

  function tagSizes(rows) {
    for (const row of rows) {
      const badge = badgeFor(row);
      if (badge) row.append(badge);
    }
  }

  const api = { badgeFor, tagSizes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).sizeBadge = api;
})();
