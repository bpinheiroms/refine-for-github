/* Migrates settings saved by older versions to the current shape.
 * Each step takes the object at version N and returns version N + 1.
 */
(() => {
  const CURRENT = 4;

  const steps = {
    // v1 → v2: "compact" split into "cards" and "compactSidebar"
    1: (s) => {
      const { compact, ...rest } = s;
      return { ...rest, cards: compact ?? true, compactSidebar: compact ?? true };
    },
    // v2 → v3: accent "purple" renamed to "violet"
    2: (s) => ({ ...s, accent: s.accent === "purple" ? "violet" : s.accent }),
    // v3 → v4: per-feature toggles removed, only enabled + accent remain meaningful
    3: (s) => ({ enabled: s.enabled ?? true, accent: s.accent ?? "violet" }),
  };

  function migrate(saved) {
    if (!saved || typeof saved !== "object") return { schema: CURRENT };
    let version = Number(saved.schema) || 1;
    let s = { ...saved };
    while (version < CURRENT - 1) {
      s = steps[version](s);
      version++;
    }
    return { ...s, schema: CURRENT };
  }

  const api = { migrate, CURRENT };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).migrate = api;
})();
