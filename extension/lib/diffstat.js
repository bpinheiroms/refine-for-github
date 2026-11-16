/* Reads the "+120 −30" diffstat GitHub shows next to the Files changed tab. */
(() => {
  function parseDiffstat(text) {
    const s = String(text ?? "").replace(/,/g, "");
    const add = s.match(/\+(\d+)/);
    const del = s.match(/-(\d+)/);
    return { additions: add ? Number(add[1]) : 0, deletions: del ? Number(del[1]) : 0 };
  }

  // Size bucket used for the row badge.
  function sizeOf({ additions, deletions }) {
    const total = additions + deletions;
    if (total < 10) return "xs";
    if (total < 100) return "s";
    if (total < 500) return "m";
    if (total < 1000) return "l";
    return "xl";
  }

  const ratio = ({ additions, deletions }) => additions / (additions + deletions);

  const api = { parseDiffstat, sizeOf, ratio };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).diffstat = api;
})();
