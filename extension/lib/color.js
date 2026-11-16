/* Color math for label chips and the accent palette (WCAG contrast). */
(() => {
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function luminance({ r, g, b }) {
    const ch = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  }

  function contrast(a, b) {
    const la = luminance(hexToRgb(a));
    const lb = luminance(hexToRgb(b));
    return (la + 0.05) / (lb + 0.05);
  }

  // Black or white text, whichever reads better on `bg`.
  const textOn = (bg) => (contrast(bg, "#000000") >= contrast(bg, "#ffffff") ? "#000000" : "#ffffff");

  const api = { hexToRgb, luminance, contrast, textOn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).color = api;
})();
