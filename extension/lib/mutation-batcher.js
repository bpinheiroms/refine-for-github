/* Collects MutationObserver records and hands them over once per frame. */
(() => {
  function createBatcher(target, onBatch, { raf = globalThis.requestAnimationFrame } = {}) {
    let queue = [];
    let scheduled = false;

    const observer = new MutationObserver((records) => {
      queue.push(...records);
      if (scheduled) return;
      scheduled = true;
      raf(() => {
        scheduled = false;
        const batch = queue;
        queue = [];
        onBatch(batch);
      });
    });

    function start() {
      observer.observe(target, { childList: true, subtree: true, attributes: true });
    }

    // Called on SPA navigation: a new batcher is created for the new page.
    function stop() {
      queue = [];
    }

    return { start, stop };
  }

  const api = { createBatcher };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).batcher = api;
})();
