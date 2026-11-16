/* DOM helpers for the nodes we add (panel, stack headers, toasts). */
(() => {
  const qs = (sel, scope = document) => scope.querySelector(sel);
  const qsa = (sel, scope = document) => [...scope.querySelectorAll(sel)];

  // Tagged template: html`<b>${name}</b>` → DocumentFragment
  function html(strings, ...values) {
    const markup = strings.reduce((acc, s, i) => acc + s + (i < values.length ? values[i] : ""), "");
    const tpl = document.createElement("template");
    tpl.innerHTML = markup;
    return tpl.content;
  }

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, "");
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const c of children.flat()) node.append(c?.nodeType ? c : String(c ?? ""));
    return node;
  }

  // Ours: anything with an id starting with gr- or inside one.
  const isOurs = (node) => !!node?.closest?.("[id^='gr-']");

  const api = { qs, qsa, html, el, isOurs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).dom = api;
})();
