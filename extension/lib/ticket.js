/* Ticket keys (ABC-123) in branch names and titles, for grouping stacked PRs. */
(() => {
  const TICKET = /([A-Z][A-Z0-9]+-\d+)/g;

  function ticketsIn(text) {
    return [...new Set(String(text ?? "").toUpperCase().match(TICKET) || [])];
  }

  const firstTicket = (...texts) => texts.map(ticketsIn).find((t) => t.length)?.[0] ?? null;

  const api = { ticketsIn, firstTicket };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).ticket = api;
})();
