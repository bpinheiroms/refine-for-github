/* Copy to clipboard with a small "Copied" feedback on the trigger. */
(() => {
  function copy(text) {
    try {
      navigator.clipboard.writeText(String(text));
      return true;
    } catch {
      return false;
    }
  }

  function copyWithFeedback(button, text, label = "Copied") {
    const original = button.textContent;
    if (copy(text)) {
      button.textContent = label;
      setTimeout(() => { button.textContent = original; }, 1200);
    }
  }

  const api = { copy, copyWithFeedback };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).clipboard = api;
})();
