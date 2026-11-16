/* Keyboard shortcuts: "g o" opens the Overview, "]" / "[" walk the panel threads. */
(() => {
  function parseCombo(combo) {
    return combo.split(" ").map((step) => {
      const parts = step.split("+");
      const key = parts.pop().toLowerCase();
      return {
        key,
        ctrl: parts.includes("ctrl"),
        meta: parts.includes("meta"),
        alt: parts.includes("alt"),
        shift: parts.includes("shift"),
      };
    });
  }

  const matches = (step, e) =>
    e.key.toLowerCase() === step.key && e.ctrlKey === step.ctrl && e.metaKey === step.meta
    && e.altKey === step.alt && e.shiftKey === step.shift;

  function bindShortcuts(target, map, { timeout = 800 } = {}) {
    const bindings = Object.entries(map).map(([combo, fn]) => ({ steps: parseCombo(combo), fn }));
    let buffer = [];
    let timer = null;

    function onKey(e) {
      clearTimeout(timer);
      buffer.push(e);
      timer = setTimeout(() => { buffer = []; }, timeout);
      for (const { steps, fn } of bindings) {
        const tail = buffer.slice(-steps.length);
        if (tail.length === steps.length && steps.every((s, i) => matches(s, tail[i]))) {
          e.preventDefault();
          buffer = [];
          fn(e);
          return;
        }
      }
    }

    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  }

  const api = { parseCombo, bindShortcuts };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).shortcuts = api;
})();
