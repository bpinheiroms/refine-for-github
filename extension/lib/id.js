/* Ids for the nodes we create (aria-controls, labels). */
(() => {
  let counter = 0;
  const uid = (prefix = "gr") => `${prefix}-${(++counter).toString(36)}`;
  const reset = () => { counter = 0; };

  const api = { uid, reset };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).id = api;
})();
