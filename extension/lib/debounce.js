/* Rate limiting for handlers bound to GitHub's very chatty DOM. */
(() => {
  function debounce(fn, wait = 100) {
    let timer = null;
    const debounced = function (...args) {
      timer = setTimeout(() => {
        timer = null;
        fn.apply(this, args);
      }, wait);
    };
    debounced.cancel = () => { clearTimeout(timer); timer = null; };
    return debounced;
  }

  function throttle(fn, wait = 100) {
    let last = 0, trailing = null;
    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - last);
      if (remaining <= 0) {
        clearTimeout(trailing);
        trailing = null;
        last = now;
        fn.apply(this, args);
      } else if (!trailing) {
        trailing = setTimeout(() => {
          last = Date.now();
          trailing = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  const api = { debounce, throttle };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).debounce = api;
})();
