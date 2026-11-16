/* Who approved, who requested changes: the latest review of each reviewer wins. */
(() => {
  // reviews: [{ login, state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED", at: ISO date }]
  function latestByReviewer(reviews) {
    const sorted = [...reviews].sort((a, b) => a.at > b.at);
    const out = new Map();
    for (const r of sorted) {
      if (r.state === "COMMENTED") continue;
      if (!out.has(r.login)) out.set(r.login, r.state);
    }
    return out;
  }

  function decision(reviews, required = 1) {
    const latest = [...latestByReviewer(reviews).values()];
    if (latest.includes("CHANGES_REQUESTED")) return "changes_requested";
    const approvals = latest.filter((s) => s === "APPROVED").length;
    return approvals >= required ? "approved" : "review_required";
  }

  const api = { latestByReviewer, decision };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).reviews = api;
})();
