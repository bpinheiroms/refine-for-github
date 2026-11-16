/* Relative and absolute time formatting for the cockpit and the lists.
 * Mirrors GitHub's own wording ("3 minutes ago", "yesterday") so our labels do
 * not look foreign next to theirs.
 */
(() => {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const unit = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function relativeTime(date, now = Date.now()) {
    const diff = now - new Date(date).getTime();
    if (Number.isNaN(diff)) return "";
    if (diff < MINUTE) return "just now";
    if (diff < HOUR) return `${unit(Math.floor(diff / MINUTE), "minute")} ago`;
    if (diff < DAY) return `${unit(Math.floor(diff / HOUR), "hour")} ago`;
    if (diff < 2 * DAY) return "yesterday";
    if (diff < 30 * DAY) return `${unit(Math.floor(diff / DAY), "day")} ago`;
    if (diff < 365 * DAY) return `${unit(Math.floor(diff / (30 * DAY)), "month")} ago`;
    return `${unit(Math.floor(diff / (365 * DAY)), "year")} ago`;
  }

  // "1h 4m", "2d 3h", "45s" — used for check durations.
  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return "";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s % 60}s`;
    return `${s}s`;
  }

  function isStale(date, days = 14, now = Date.now()) {
    return now - new Date(date).getTime() > days * DAY;
  }

  const api = { relativeTime, formatDuration, isStale, MINUTE, HOUR, DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).time = api;
})();
