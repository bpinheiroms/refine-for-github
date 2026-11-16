const { t } = GRLib.i18n;
const { withDefaults } = GRLib.merge;
const { migrate } = GRLib.migrate;
const storage = GRLib.storage;
const { debounce } = GRLib.debounce;

const inputs = document.querySelectorAll("input[data-key]");
const swatches = document.querySelectorAll("[data-accent]");

function translate() {
  for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
}

function render(s) {
  for (const input of inputs) input.checked = !!s[input.dataset.key];
  for (const sw of swatches) {
    const on = sw.dataset.accent === s.accent;
    sw.classList.toggle("active", on);
    if (on) document.documentElement.style.setProperty("--accent", sw.style.getPropertyValue("--c"));
  }
  document.body.classList.toggle("off", !s.enabled);
  document.body.title = s.enabled ? t("popupEnabled") : t("popupDisabled");
}

// Saving is debounced: clicking through the swatches writes once.
const save = debounce((patch) => storage.save(patch), 150);

async function init() {
  translate();
  const saved = await storage.load(GR_DEFAULTS);
  const settings = withDefaults(GR_DEFAULTS, migrate(saved));
  render(settings);
  storage.subscribe(render);

  for (const input of inputs) {
    input.addEventListener("change", () => {
      settings[input.dataset.key] = input.checked;
      save({ [input.dataset.key]: input.checked });
      render(settings);
    });
  }
  for (const sw of swatches) {
    sw.addEventListener("click", () => {
      settings.accent = sw.dataset.accent;
      save({ accent: sw.dataset.accent });
      render(settings);
    });
  }
}

init();
