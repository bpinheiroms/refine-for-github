// Stub de chrome.storage para rodar o content script fora da extensão,
// e ligação do painel "Simulação do popup" (#proto) às configurações.
(() => {
  const listeners = [];
  // ?off = extensão desligada (para comparar antes/depois); ?toc = índice já aberto
  const params = new URLSearchParams(location.search);
  const store = params.has("off") ? { enabled: false } : {};
  window.chrome = {
    storage: {
      sync: {
        get(defs, cb) { cb({ ...defs, ...store }); },
        set(obj) {
          const changes = {};
          for (const k in obj) changes[k] = { newValue: obj[k] };
          Object.assign(store, obj);
          listeners.forEach((fn) => fn(changes, "sync"));
        },
      },
      onChanged: { addListener(fn) { listeners.push(fn); } },
    },
  };
  try { localStorage.removeItem("gr-settings-cache"); } catch {}

  document.addEventListener("DOMContentLoaded", () => {
    const proto = document.getElementById("proto");
    if (!proto) return;
    const sync = () => chrome.storage.sync.get(GR_DEFAULTS, (s) =>
      proto.querySelectorAll("input").forEach((i) => (i.checked = !!s[i.dataset.key])));
    proto.querySelectorAll("input").forEach((i) =>
      i.addEventListener("change", () => chrome.storage.sync.set({ [i.dataset.key]: i.checked })));
    proto.querySelectorAll("[data-accent]").forEach((b) =>
      b.addEventListener("click", () => chrome.storage.sync.set({ accent: b.dataset.accent })));
    sync();
    if (params.has("toc")) {
      const open = () => { const t = document.getElementById("gr-toc"); t ? t.setAttribute("data-open", "") : setTimeout(open, 50); };
      open();
    }
  });
})();
