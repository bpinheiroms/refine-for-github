/* Date windows for the "updated this week" divider in the lists. */
(() => {
  function startOfDay(date) {
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function daysAgo(n, from = new Date()) {
    const d = startOfDay(from);
    d.setDate(d.getDate() - n);
    return d;
  }

  const within = (date, days, now = new Date()) => new Date(date) >= daysAgo(days, now);

  function bucket(date, now = new Date()) {
    if (within(date, 0, now)) return "today";
    if (within(date, 7, now)) return "this-week";
    if (within(date, 30, now)) return "this-month";
    return "older";
  }

  const api = { startOfDay, daysAgo, within, bucket };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).dateRange = api;
})();
