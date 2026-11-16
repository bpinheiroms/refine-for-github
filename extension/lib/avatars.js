/* Avatar URLs at the size we draw them (2x for retina). */
(() => {
  function avatarUrl(src, size = 20) {
    if (!src) return "";
    return `${src}?s=${size * 2}`;
  }

  const avatarFor = (login, size = 20) => avatarUrl(`https://github.com/${login}.png`, size);

  const api = { avatarUrl, avatarFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).avatars = api;
})();
