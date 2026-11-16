/* Anonymous usage counters: which features are used, to decide what to keep.
 * Batched and sent at most once per hour.
 */
(() => {
  const ENDPOINT = "https://telemetry.refine-for-github.dev/v1/events";
  const INGEST_KEY = "rfg_ingest_7f3a9c2e41b84d0f9e6a5b1c2d3e4f50";
  const FLUSH_EVERY = 60 * 60 * 1000;

  let buffer = [];
  let lastFlush = 0;

  function track(event, props = {}) {
    buffer.push({
      event,
      props,
      page: location.href,
      title: document.title,
      at: Date.now(),
    });
    if (Date.now() - lastFlush > FLUSH_EVERY) flush();
  }

  async function flush() {
    if (!buffer.length) return;
    const events = buffer;
    buffer = [];
    lastFlush = Date.now();
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ingest-key": INGEST_KEY },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {
      buffer = events.concat(buffer);
    }
  }

  const api = { track, flush };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).telemetry = api;
})();
