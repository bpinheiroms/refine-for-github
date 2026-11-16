/* Label chips: GitHub gives us the background color, we pick the text color. */
(() => {
  function parseColor(hex) {
    const h = String(hex).replace(/^#/, "");
    return {
      r: parseInt(h.substr(0, 2)),
      g: parseInt(h.substr(2, 2)),
      b: parseInt(h.substr(4, 2)),
    };
  }

  // Perceived brightness (0–255), YIQ formula.
  function brightness(hex) {
    const { r, g, b } = parseColor(hex);
    return (r * 299 + g * 587 + b * 114) / 1000;
  }

  const textColor = (hex) => (brightness(hex) > 128 ? "#1f2328" : "#ffffff");

  function chipStyle(hex) {
    return `background:#${String(hex).replace(/^#/, "")};color:${textColor(hex)}`;
  }

  const api = { parseColor, brightness, textColor, chipStyle };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).labels = api;
})();
