/* Orders the PRs of a stack from the bottom (based on the default branch) to the top.
 * prs: [{ number, head, base }]
 */
(() => {
  function orderStack(prs) {
    const byBase = new Map(prs.map((p) => [p.base, p]));
    const heads = new Set(prs.map((p) => p.head));
    const bottom = prs.find((p) => !heads.has(p.base));
    if (!bottom) return [...prs];
    const out = [];
    let cur = bottom;
    while (cur) {
      out.push(cur);
      cur = byBase.get(cur.head);
    }
    return out;
  }

  const positionOf = (ordered, number) => ordered.findIndex((p) => p.number === number) + 1;

  const api = { orderStack, positionOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).stack = api;
})();
