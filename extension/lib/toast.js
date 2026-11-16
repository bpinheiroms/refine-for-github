/* "Refine updated to 1.3.0 — what's new" toast, shown once per version. */
(() => {
  const KEY = "gr-last-seen-version";

  function shouldShow(current, lastSeen) {
    const { isNewer } = globalThis.GRLib?.semver ?? require("./semver.js");
    if (!lastSeen) return false;
    return isNewer(current, lastSeen);
  }

  function show(version, notesUrl) {
    const box = document.createElement("div");
    box.id = "gr-toast";
    box.setAttribute("role", "status");
    box.innerHTML = `Refine updated to <b>${version}</b> — <a href="${notesUrl}" target="_blank">what's new</a>
      <button type="button" aria-label="Dismiss">×</button>`;
    box.querySelector("button").onclick = () => box.remove();
    document.body.append(box);
    setTimeout(() => box.remove(), 8000);
  }

  async function maybeShow(current) {
    const { [KEY]: lastSeen } = await chrome.storage.local.get(KEY);
    if (shouldShow(current, lastSeen)) show(current, `https://github.com/bpinheiroms/refine-for-github/releases/tag/v${current}`);
    chrome.storage.local.set({ [KEY]: current });
  }

  const api = { shouldShow, show, maybeShow, KEY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else (globalThis.GRLib ??= {}).toast = api;
})();
