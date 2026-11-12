const inputs = document.querySelectorAll("input[data-key]");
const swatches = document.querySelectorAll("[data-accent]");

function render(s) {
  for (const input of inputs) input.checked = !!s[input.dataset.key];
  for (const sw of swatches) {
    const on = sw.dataset.accent === s.accent;
    sw.classList.toggle("active", on);
    if (on) document.documentElement.style.setProperty("--accent", sw.style.getPropertyValue("--c"));
  }
  document.body.classList.toggle("off", !s.enabled);
}

chrome.storage.sync.get(GR_DEFAULTS, render);

for (const input of inputs) {
  input.addEventListener("change", () => {
    chrome.storage.sync.set({ [input.dataset.key]: input.checked });
    chrome.storage.sync.get(GR_DEFAULTS, render);
  });
}
for (const sw of swatches) {
  sw.addEventListener("click", () => {
    chrome.storage.sync.set({ accent: sw.dataset.accent });
    chrome.storage.sync.get(GR_DEFAULTS, render);
  });
}

