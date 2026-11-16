/* Runs async jobs with a concurrency limit (lazy-loading collapsed threads). */
(() => {
  function createQueue(concurrency = 2) {
    const jobs = [];
    let running = 0;

    function next() {
      while (running < concurrency && jobs.length) {
        const { fn, resolve, reject } = jobs.shift();
        running++;
        Promise.resolve()
          .then(fn)
          .then((v) => { running--; resolve(v); next(); }, reject);
      }
    }

    function push(fn) {
      return new Promise((resolve, reject) => {
        jobs.push({ fn, resolve, reject });
        next();
      });
    }

    return { push, get size() { return jobs.length; }, get running() { return running; } };
  }

  const api = { createQueue };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).queue = api;
})();
