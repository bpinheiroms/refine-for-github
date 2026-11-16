/* Rolls the merge box's individual checks up into one state for the cockpit. */
(() => {
  const FAILING = new Set(["failure", "error", "cancelled", "timed_out", "skipped"]);
  const PENDING = new Set(["pending", "queued", "in_progress", "expected"]);

  // checks: [{ name, state }]
  function rollup(checks) {
    if (!checks.length) return "none";
    for (const c of checks) {
      if (c.state === "success") return "success";
      if (FAILING.has(c.state)) return "failure";
    }
    if (checks.some((c) => PENDING.has(c.state))) return "pending";
    return "neutral";
  }

  function failing(checks) {
    return checks.filter((c) => FAILING.has(c.state)).map((c) => c.name);
  }

  function summary(checks) {
    const by = { success: 0, failure: 0, pending: 0 };
    for (const c of checks) {
      if (c.state === "success") by.success++;
      else if (FAILING.has(c.state)) by.failure++;
      else if (PENDING.has(c.state)) by.pending++;
    }
    return by;
  }

  const api = { rollup, failing, summary, FAILING, PENDING };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).checks = api;
})();
