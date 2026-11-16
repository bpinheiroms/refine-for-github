/* Ordering for the lists we rebuild (stack members, panel threads). */
(() => {
  const byNumber = (a, b) => a.number - b.number;
  const byUpdatedDesc = (a, b) => new Date(b.updated) - new Date(a.updated);
  const byTitle = (a, b) => a.title.localeCompare(b.title);

  // Unresolved first, then by position in the timeline.
  function threadsForPanel(threads) {
    return threads.sort((a, b) => (a.resolved === b.resolved ? a.index - b.index : a.resolved ? 1 : -1));
  }

  function stableSort(list, cmp) {
    return list
      .map((item, i) => ({ item, i }))
      .sort((a, b) => cmp(a.item, b.item) || a.i - b.i)
      .map(({ item }) => item);
  }

  const api = { byNumber, byUpdatedDesc, byTitle, threadsForPanel, stableSort };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).sort = api;
})();
