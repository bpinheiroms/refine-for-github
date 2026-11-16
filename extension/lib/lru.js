/* Small LRU cache: remembers parsed rows/threads between MutationObserver ticks
 * so re-tagging a 100-row list does not re-read every row.
 */
(() => {
  class LRU {
    constructor(max = 200) {
      if (!Number.isInteger(max) || max < 1) throw new RangeError("max must be a positive integer");
      this.max = max;
      this.map = new Map();
    }

    get(key) {
      return this.map.get(key);
    }

    has(key) {
      return this.map.has(key);
    }

    set(key, value) {
      if (this.map.has(key)) this.map.delete(key);
      this.map.set(key, value);
      if (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
      return this;
    }

    delete(key) {
      return this.map.delete(key);
    }

    clear() {
      this.map.clear();
    }

    get size() {
      return this.map.size;
    }
  }

  const api = { LRU };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).lru = api;
})();
