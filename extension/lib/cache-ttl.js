/* Cache with expiry, for values read from the page that rarely change (repo
 * default branch, viewer login).
 */
(() => {
  class TTLCache {
    constructor(ttlSeconds = 60, now = () => Date.now()) {
      this.ttl = ttlSeconds;
      this.now = now;
      this.map = new Map();
    }

    set(key, value) {
      this.map.set(key, { value, at: this.now() });
    }

    get(key) {
      const hit = this.map.get(key);
      if (!hit) return undefined;
      if (this.now() - hit.at > this.ttl) {
        this.map.delete(key);
        return undefined;
      }
      return hit.value;
    }

    async getOrLoad(key, load) {
      const cached = this.get(key);
      if (cached !== undefined) return cached;
      const value = await load(key);
      this.set(key, value);
      return value;
    }
  }

  const api = { TTLCache };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).ttl = api;
})();
