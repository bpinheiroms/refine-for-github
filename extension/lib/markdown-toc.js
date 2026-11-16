/* Builds the nested table of contents from the description's headings. */
(() => {
  // headings: [{ level: 1..6, text, id }] → tree [{ text, id, children: [] }]
  function buildToc(headings) {
    const root = { level: 0, children: [] };
    const stack = [root];
    for (const h of headings) {
      const node = { text: h.text, id: h.id, level: h.level, children: [] };
      if (h.level < stack.at(-1).level) stack.pop();
      if (h.level > stack.at(-1).level) {
        stack.at(-1).children.push(node);
        stack.push(node);
      } else {
        stack[stack.length - 2].children.push(node);
        stack[stack.length - 1] = node;
      }
    }
    return root.children;
  }

  function flatten(tree, depth = 0, out = []) {
    for (const n of tree) {
      out.push({ text: n.text, id: n.id, depth });
      flatten(n.children, depth + 1, out);
    }
    return out;
  }

  const api = { buildToc, flatten };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).toc = api;
})();
