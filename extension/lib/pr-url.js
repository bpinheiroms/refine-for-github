/* Parsing and building GitHub pull request / issue URLs.
 * Used by the stack grouping and the "copy link" button.
 */
(() => {
  const PATH = /^\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)(?:\/(files|commits|checks))?\/?$/;

  function parsePrUrl(href) {
    if (typeof href !== "string" || !href.startsWith("https://github.com")) return null;
    let url;
    try { url = new URL(href); } catch { return null; }
    const m = url.pathname.match(PATH);
    if (!m) return null;
    return {
      owner: m[1],
      repo: m[2],
      kind: m[3] === "pull" ? "pr" : "issue",
      number: Number(m[4]),
      tab: m[5] || "conversation",
      hash: url.hash.slice(1) || null,
    };
  }

  function buildPrUrl({ owner, repo, number, kind = "pr", tab }) {
    const base = `https://github.com/${owner}/${repo}/${kind === "pr" ? "pull" : "issues"}/${number}`;
    return tab && tab !== "conversation" ? `${base}/${tab}` : base;
  }

  const samePr = (a, b) => !!a && !!b && a.owner === b.owner && a.repo === b.repo && a.number === b.number;

  const api = { parsePrUrl, buildPrUrl, samePr };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).prUrl = api;
})();
