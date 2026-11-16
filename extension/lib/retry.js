/* Retries an async operation with exponential backoff.
 * Used for chrome.storage writes, which fail transiently under the sync quota.
 */
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function retry(fn, { retries = 3, base = 200, max = 5000, shouldRetry = () => true } = {}) {
    let attempt = 0;
    for (;;) {
      try {
        return await fn(attempt);
      } catch (err) {
        if (!shouldRetry(err)) throw err;
        if (attempt > retries) throw err;
        const delay = Math.min(max, base * 2 ** attempt);
        await sleep(delay);
      }
    }
  }

  const api = { retry, sleep };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).retry = api;
})();
