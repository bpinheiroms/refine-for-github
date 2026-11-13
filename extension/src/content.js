/* GitHub Refine — content script
 *
 * How the page is changed (three layers):
 *
 * 1. Settings → attributes on <html>
 *    `data-gr-theme`, `data-gr-cards`... CSS only applies when the attribute exists,
 *    so toggling is instant and leaves nothing behind.
 *
 * 2. Semantic tagging (this file)
 *    New GitHub is React with generated classes (e.g. `prc-ListView-xyz`) that change
 *    with every deploy. Instead of targeting them, we find elements by stable
 *    hints (`/pull/123` links, octicon icons, aria-labels, author names) and
 *    write OUR OWN attributes: `data-gr-row`, `data-gr-state`, `data-gr-bot`...
 *    CSS targets only these attributes. When GitHub changes its HTML, only the
 *    detection here needs adjusting.
 *
 * 3. CSS (refine.css)
 *    Primer tokens (`--bgColor-default`, ...) for the whole theme, and rules
 *    on the `data-gr-*` attributes for layout.
 *
 * Golden rule with React: never move or remove nodes React controls.
 * Reorder = CSS `order`; hide = `display: none`. We only add one node of
 * our own (the bots button), and re-insert it if React discards it.
 */
(() => {
  const root = document.documentElement;
  let settings = { ...GR_DEFAULTS };

  // ---------- SPA navigation ----------
  // GitHub changes pages without reloading (Turbo + React). One MutationObserver
  // throttled per frame covers everything: navigation, filters, pagination, lazy load.
  let pending = false;
  function scheduleTag() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; tag(); });
  }

  const observer = new MutationObserver(scheduleTag);
  function observe() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  // ---------- 1. Settings ----------

  function applySettings(s) {
    // The popup only has on/off and color: features always use the default
    // (ignores old saved choices from when there was a per-feature toggle).
    settings = { ...GR_DEFAULTS, enabled: s?.enabled ?? GR_DEFAULTS.enabled, accent: s?.accent || GR_DEFAULTS.accent };
    for (const [key, value] of Object.entries(settings)) {
      if (typeof value !== "boolean" || key === "enabled") continue;
      const attr = `data-gr-${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`;
      if (settings.enabled && value) root.setAttribute(attr, "");
      else root.removeAttribute(attr);
    }
    if (settings.enabled) root.setAttribute("data-gr-accent", settings.accent);
    else root.removeAttribute("data-gr-accent");
    scheduleTag();
  }

  // First paint: chrome.storage is async and would cause a "flash" of the
  // original look. We keep a copy in github.com's localStorage, which is
  // synchronous, and apply it right at document_start.
  try {
    const cached = localStorage.getItem(GR_CACHE_KEY);
    if (cached) applySettings(JSON.parse(cached));
  } catch {}

  chrome.storage.sync.get(GR_DEFAULTS, (s) => {
    applySettings(s);
    try { localStorage.setItem(GR_CACHE_KEY, JSON.stringify(settings)); } catch {}
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const next = { ...settings };
    for (const [k, { newValue }] of Object.entries(changes)) next[k] = newValue;
    applySettings(next);
    try { localStorage.setItem(GR_CACHE_KEY, JSON.stringify(settings)); } catch {}
  });

  // ---------- 2. Semantic tagging ----------

  const PR_HREF = /\/[^/]+\/[^/]+\/(pull|issues)\/\d+\/?$/;
  // "Dependency updates" group: PRs from the dependency bots, or anything titled like
  // a dependency bump. Other bots (release, sync, AI agents) are ordinary PRs.
  const BOT_AUTHOR = /(dependabot|renovate)/i;
  const BOT_TITLE = /^(build|chore|fix)\(deps(-dev)?\)|^bump\s|^update (dependency|module|[\w@./-]+ to v?\d)|^lock file maintenance/i;

  function rowStateOf(row) {
    // Only the row itself: a merge queue row also holds its (hidden) status dialog,
    // whose check list has skip/fail icons that are not the PR's state.
    const own = (sel) => [...row.querySelectorAll(sel)].filter((el) => !el.closest("dialog, [role='dialog']"));
    const has = (sel) => own(sel).length > 0;
    const label = own("svg[aria-label], [aria-label] > svg")
      .map((el) => (el.getAttribute("aria-label") || el.parentElement.getAttribute("aria-label") || "").toLowerCase())
      .join(" ");
    if (has(".octicon-git-pull-request-draft, .octicon-issue-draft") || label.includes("draft")
      || own("span, div").some((e) => !e.children.length && e.textContent.trim() === "Draft")) return "draft";
    if (has(".octicon-git-merge") || label.includes("merged")) return "merged";
    if (has(".octicon-git-pull-request-closed, .octicon-skip, .octicon-issue-closed") || label.includes("closed")) return "closed";
    return "open";
  }

  function tagListRows() {
    // Lists only (PRs, issues, search). On an open issue/PR, timeline
    // "mentioned this" links are not list rows: clear tags left over
    // from a previously visited list (navigation without reload).
    if (/\/(issues|pull)\/\d+/.test(location.pathname)) {
      for (const el of document.querySelectorAll("[data-gr-row], [data-gr-title], [data-gr-list]")) {
        if (el.closest("#gr-panel, #gr-cockpit, #gr-modal")) continue;
        for (const a of ["data-gr-row", "data-gr-title", "data-gr-list", "data-gr-state", "data-gr-bot", "data-gr-draft", "data-gr-queued", ...STACK_ATTRS]) el.removeAttribute(a);
        el.style?.removeProperty("--gr-ord");
      }
      document.querySelectorAll("main .gr-bot-toggle, main .gr-stack-head").forEach((t) => t.remove());
      return;
    }
    const lists = new Set();
    for (const link of document.querySelectorAll('a[href*="/pull/"], a[href*="/issues/"]')) {
      const href = link.getAttribute("href") || "";
      if (!PR_HREF.test(href)) continue;
      // Row = the nearest <li> (new React list) or the old list's row.
      const row = link.closest('li, [role="listitem"], .js-issue-row');
      if (!row || row.closest("[data-gr-skip], .markdown-body, nav, header")) continue;
      // The first PR link in the row is the title; ignore secondary links.
      const title = row.querySelector("[data-gr-title]");
      if (title && title !== link) continue;

      link.setAttribute("data-gr-title", "");
      row.setAttribute("data-gr-row", "");
      row.setAttribute("data-gr-state", rowStateOf(row));

      const authorText = [...row.querySelectorAll('a[data-hovercard-url*="/users/"], a[href*="author%3A"], a[href*="author:"]')]
        .map((a) => a.textContent).join(" ");
      // In the merge queue: its own group (they merge on their own, nothing to do).
      const queued = inMergeQueue(row);
      const isBot = !queued && (BOT_AUTHOR.test(authorText) || BOT_TITLE.test(link.textContent.trim()));
      row.toggleAttribute("data-gr-queued", queued);
      row.toggleAttribute("data-gr-bot", isBot);
      row.toggleAttribute("data-gr-draft", !isBot && !queued && row.getAttribute("data-gr-state") === "draft");
      const stack = !isBot && !queued && stackOf(row);
      if (stack) {
        row.setAttribute("data-gr-stack-pos", stack.pos);
        row.setAttribute("data-gr-stack-total", stack.total);
        row.setAttribute("data-gr-stack-id", stack.id);
        row.setAttribute("data-gr-stack-author", authorText.trim());
      } else for (const a of STACK_ATTRS) row.removeAttribute(a);

      if (row.parentElement) lists.add(row.parentElement);
    }
    for (const list of lists) {
      list.setAttribute("data-gr-list", "");
      groupStacks(list);
      ensureBotToggle(list);
      ensureDraftToggle(list);
      ensureQueueToggle(list);
    }
  }

  // ---------- Stacked PRs ----------
  // A PR in a stack shows the stack icon and its place in it ("2/3"). PRs of the same
  // stack are shown together, in merge order (1 → n), under one header, at the place
  // of the stack's first PR in the list. Nothing is moved: CSS `order` again.
  //
  // Which stack a PR belongs to: GitHub's stack number when the badge exposes it
  // (link, label, tooltip). Otherwise: same repository + same author + same stack size
  // + same ticket (SPRK-123) in the title; without a ticket there is no group. Two
  // stacks must never be merged into one, so a group where a position repeats
  // (two "1/3") is left alone too.
  const STACK_ATTRS = ["data-gr-stack", "data-gr-stack-pos", "data-gr-stack-total", "data-gr-stack-id", "data-gr-stack-author", "data-gr-stack-closed", "data-gr-stack-last"];
  // "Stack #19177" or a /stacks/19177 link. Not "Pull request stack, position 3 of 3".
  const STACK_ID = /\/stacks\/(\d+)|\bstack\s*#\s*(\d+)/i;
  const TICKET = /\b[A-Z][A-Z0-9]+-\d+\b/;
  const FRACTION = /\b(\d+)\s*\/\s*(\d+)\b/g;

  function stackOf(row) {
    const icon = [...row.querySelectorAll(".octicon-stack")]
      .find((el) => !el.closest("dialog, [role='dialog'], [data-gr-title], .markdown-body"));
    if (!icon) return null;
    // The badge: the closest wrapper of the icon with exactly one "n/m" in it
    // (higher up, the checks "38/42" would also match).
    let badge = icon.parentElement, m = null;
    for (let up = 0; badge && badge !== row && up < 4; up++, badge = badge.parentElement) {
      const all = [...badge.textContent.matchAll(FRACTION)];
      if (all.length > 1) return null;
      if (all.length === 1) { m = all[0]; break; }
    }
    if (!m) return null;
    const pos = +m[1], total = +m[2];
    if (!pos || !total || pos > total) return null;
    // GitHub's stack number, if the badge or its tooltip carries it.
    let id = "";
    for (let el = icon; el && el !== row && !id; el = el.parentElement) {
      const texts = ["href", "aria-label", "title", "data-hovercard-url"].map((a) => el.getAttribute(a) || "");
      for (const a of ["aria-describedby", "aria-labelledby"])
        for (const ref of (el.getAttribute(a) || "").split(/\s+/)) if (ref) texts.push(document.getElementById(ref)?.textContent || "");
      id = texts.map((t) => { const m = STACK_ID.exec(t); return m && (m[1] || m[2]); }).find(Boolean) || "";
    }
    return { pos, total, id };
  }


  function groupStacks(list) {
    const rows = [...list.querySelectorAll(":scope > [data-gr-row]")];
    const groups = new Map();
    rows.forEach((row, i) => {
      for (const a of ["data-gr-stack", "data-gr-stack-closed", "data-gr-stack-last"]) row.removeAttribute(a);
      // Rows keep their list order; a stack takes the slot of its first PR.
      row.style.setProperty("--gr-ord", -100000 + i * 100);
      if (!row.hasAttribute("data-gr-stack-pos")) return;
      const link = row.querySelector("[data-gr-title]");
      const ticket = TICKET.exec(link?.textContent || "")?.[0] || "";
      const id = row.getAttribute("data-gr-stack-id");
      // Without GitHub's number, the ticket is required: a stack missing some of its
      // PRs (merged ones are not in the open list) shows no repeated position.
      if (!id && !ticket) return;
      // owner/repo: dashboards and search list PRs from several repositories.
      const repo = /^(?:https?:\/\/[^/]+)?\/([^/]+\/[^/]+)\/pull\//.exec(link?.getAttribute("href") || "")?.[1] || "";
      const total = row.getAttribute("data-gr-stack-total");
      const key = id ? `${repo}#${id}` : `${repo}|${row.getAttribute("data-gr-stack-author")}|${total}|${ticket}`;
      if (!groups.has(key)) groups.set(key, { key, id, ticket, total: +total, first: i, rows: [] });
      groups.get(key).rows.push({ row, pos: +row.getAttribute("data-gr-stack-pos") });
    });

    const heads = new Set();
    for (const g of groups.values()) {
      const positions = new Set(g.rows.map((r) => r.pos));
      // Fewer than two PRs, or a repeated position (two different stacks): no group.
      if (g.rows.length < 2 || positions.size !== g.rows.length) continue;
      const base = -100000 + g.first * 100;
      const closed = sessionStorage.getItem(`gr-stack-closed:${g.key}`) === "1";
      g.rows.sort((a, b) => a.pos - b.pos);
      g.rows.forEach(({ row, pos }, n) => {
        row.setAttribute("data-gr-stack", g.key);
        row.style.setProperty("--gr-ord", base + pos);
        row.removeAttribute("data-gr-draft"); // a draft stays inside its stack
        row.toggleAttribute("data-gr-stack-closed", closed);
        row.toggleAttribute("data-gr-stack-last", n === g.rows.length - 1);
      });

      let head = [...list.querySelectorAll(":scope > .gr-stack-head")].find((h) => h.dataset.key === g.key);
      if (!head) {
        head = document.createElement("button");
        head.type = "button";
        head.className = "gr-stack-head";
        head.dataset.key = g.key;
        head.addEventListener("click", () => {
          const close = head.getAttribute("aria-expanded") === "true";
          sessionStorage.setItem(`gr-stack-closed:${g.key}`, close ? "1" : "");
          scheduleTag();
        });
        list.appendChild(head);
      }
      heads.add(head);
      head.style.setProperty("--gr-ord", base);
      head.setAttribute("aria-expanded", String(!closed));
      const name = g.ticket || "Stack";
      const count = g.rows.length === g.total ? `${g.total} PRs` : `${g.rows.length} of ${g.total} PRs here`;
      const text = `${name}|${count}|${g.id}`;
      if (head.dataset.text !== text) {
        head.dataset.text = text;
        // Octicon stack and chevron (a literal: the Firefox linter rejects built innerHTML)
        head.innerHTML = '<span class="gr-stack-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M7.122.392a1.75 1.75 0 0 1 1.756 0l5.003 2.902c.83.481.83 1.68 0 2.162L8.878 8.358a1.75 1.75 0 0 1-1.756 0L2.119 5.456a1.251 1.251 0 0 1 0-2.162ZM8.125 1.69a.248.248 0 0 0-.25 0l-4.63 2.685 4.63 2.685a.248.248 0 0 0 .25 0l4.63-2.685ZM1.601 7.789a.75.75 0 0 1 1.025-.273l5.249 3.044a.248.248 0 0 0 .25 0l5.249-3.044a.75.75 0 0 1 .752 1.298l-5.248 3.044a1.75 1.75 0 0 1-1.756 0L1.874 8.814A.75.75 0 0 1 1.6 7.789Zm0 3.5a.75.75 0 0 1 1.025-.273l5.249 3.044a.248.248 0 0 0 .25 0l5.249-3.044a.75.75 0 0 1 .752 1.298l-5.248 3.044a1.75 1.75 0 0 1-1.756 0l-5.248-3.044a.75.75 0 0 1-.273-1.025Z"/></svg></span><span class="gr-stack-name"></span><span class="gr-stack-meta"></span><span class="gr-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg></span>';
        head.querySelector(".gr-stack-name").textContent = name;
        head.querySelector(".gr-stack-meta").textContent = `Stack${g.id ? ` #${g.id}` : ""} · ${count} · merge order 1 → ${g.total}`;
      }
    }
    for (const h of list.querySelectorAll(":scope > .gr-stack-head")) if (!heads.has(h)) h.remove();
  }

  // PR list: "Compact" density by default. Clicks GitHub's own button once
  // (it remembers the choice). If the user picks "Comfortable" later, we respect it.
  let densityTried = "";
  const isOn = (b) => ["aria-pressed", "aria-current", "aria-checked", "aria-selected"].some((k) => /^(true|page)$/.test(b.getAttribute(k) || ""))
    || b.hasAttribute("data-selected") || b.getAttribute("data-state") === "on";
  function preferCompact() {
    const btns = [...document.querySelectorAll("main button")].filter((b) => /display density/i.test(labelOf(b)));
    const compact = btns.find((b) => /compact/i.test(labelOf(b)));
    if (!compact) return;
    for (const b of btns) {
      if (b.dataset.grDensity) continue;
      b.dataset.grDensity = "";
      b.addEventListener("click", (e) => {
        if (!e.isTrusted) return;
        if (/compact/i.test(labelOf(b))) localStorage.removeItem("gr-density-manual");
        else localStorage.setItem("gr-density-manual", "1");
      });
    }
    if (localStorage.getItem("gr-density-manual") || densityTried === location.pathname || isOn(compact)) return;
    densityTried = location.pathname;
    compact.click();
  }

  // List: highlight the active Open/Closed filter (GitHub only changes the font weight).
  // The state comes from the query (state:/is:), read from the URL or the search field.
  function tagStateFilter() {
    const q = (new URLSearchParams(location.search).get("q") || document.querySelector("main input[type='text'], main input[type='search'], main [role='combobox']")?.value || "").toLowerCase();
    const cur = /\b(?:state|is):(closed|merged)\b/.test(q) ? "closed" : "open";
    for (const a of document.querySelectorAll("main a[href*='q='], main a[href*='state='], main button")) {
      const m = /^\s*(open|closed)\b/i.exec(a.textContent || "");
      if (!m || a.closest("[data-gr-row], #gr-panel, #gr-cockpit") || a.textContent.length > 40) continue;
      if (!/\d/.test(a.textContent)) continue; // only the toggles with a count ("Open 4", "Closed 90")
      a.setAttribute("data-gr-state-tab", "");
      a.toggleAttribute("data-gr-sel", m[1].toLowerCase() === cur);
    }
  }

  // "N bot updates" button. It is the only node we insert inside a
  // React tree; it sits at the end of the container and CSS (`order`) places it before
  // the bot rows.
  function ensureBotToggle(list) {
    const bots = list.querySelectorAll(":scope > [data-gr-bot]").length;
    let toggle = list.querySelector(":scope > .gr-bot-toggle:not(.gr-draft-toggle):not(.gr-queue-toggle)");
    if (bots < 2) { toggle?.remove(); return; }

    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "gr-bot-toggle";
      toggle.addEventListener("click", () => {
        const open = !list.hasAttribute("data-gr-bots-open");
        list.toggleAttribute("data-gr-bots-open", open);
        sessionStorage.setItem("gr-bots-open", open ? "1" : "");
      });
      list.appendChild(toggle);
    }
    if (sessionStorage.getItem("gr-bots-open")) list.setAttribute("data-gr-bots-open", "");
    const text = `${bots} dependency updates`;
    if (toggle.dataset.text !== text) {
      toggle.dataset.text = text;
      // Dependabot icon (Octicon) and SVG chevron, instead of the ⚙︎ and › characters.
      toggle.innerHTML = '<span class="gr-bot-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M5.75 7.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm5.25.75a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5Z"/><path d="M6.25 0h2A.75.75 0 0 1 9 .75V3.5h3.25a2.25 2.25 0 0 1 2.25 2.25V8h.75a.75.75 0 0 1 0 1.5h-.75v2.75a2.25 2.25 0 0 1-2.25 2.25h-8.5a2.25 2.25 0 0 1-2.25-2.25V9.5H.75a.75.75 0 0 1 0-1.5h.75V5.75A2.25 2.25 0 0 1 3.75 3.5H7.5v-2H6.25a.75.75 0 0 1 0-1.5ZM3 5.75v6.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75Z"/></svg></span><span class="gr-bot-text"></span><span class="gr-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg></span>';
      toggle.querySelector(".gr-bot-text").textContent = text;
    }
  }

  // "N drafts" group: same pattern as the bots group, right before it.
  // A row is in the merge queue when it shows the merge-queue icon or the "Queued" link
  // (not counting the hidden status dialog on the queue page).
  const inMergeQueue = (row) => [...row.querySelectorAll(".octicon-git-merge-queue, a")]
    .some((el) => !el.closest("dialog, [role='dialog']") && (el.matches(".octicon-git-merge-queue") || /^queued$/i.test(el.textContent.trim())));

  // "N in merge queue" group: same pattern as drafts, right before them.
  function ensureQueueToggle(list) {
    const n = list.querySelectorAll(":scope > [data-gr-queued]").length;
    let toggle = list.querySelector(":scope > .gr-queue-toggle");
    if (n < 2) { toggle?.remove(); return; }
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "gr-bot-toggle gr-queue-toggle";
      toggle.addEventListener("click", () => {
        const open = !list.hasAttribute("data-gr-queued-open");
        list.toggleAttribute("data-gr-queued-open", open);
        sessionStorage.setItem("gr-queued-open", open ? "1" : "");
      });
      list.appendChild(toggle);
    }
    if (sessionStorage.getItem("gr-queued-open")) list.setAttribute("data-gr-queued-open", "");
    const text = `${n} in merge queue`;
    if (toggle.dataset.text !== text) {
      toggle.dataset.text = text;
      // Octicon git-merge-queue
      toggle.innerHTML = '<span class="gr-bot-icon gr-queue-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.75 4.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5ZM3 7.75a.75.75 0 0 1 1.5 0v2.878a2.251 2.251 0 1 1-1.5 0Zm.75 5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm5-7.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5.75 2.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-1.5 0a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/></svg></span><span class="gr-bot-text"></span><span class="gr-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg></span>';
      toggle.querySelector(".gr-bot-text").textContent = text;
    }
  }

  function ensureDraftToggle(list) {
    const n = list.querySelectorAll(":scope > [data-gr-draft]").length;
    let toggle = list.querySelector(":scope > .gr-draft-toggle");
    if (n < 2) { toggle?.remove(); return; }
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "gr-bot-toggle gr-draft-toggle";
      toggle.addEventListener("click", () => {
        const open = !list.hasAttribute("data-gr-drafts-open");
        list.toggleAttribute("data-gr-drafts-open", open);
        sessionStorage.setItem("gr-drafts-open", open ? "1" : "");
      });
      list.appendChild(toggle);
    }
    if (sessionStorage.getItem("gr-drafts-open")) list.setAttribute("data-gr-drafts-open", "");
    const text = `${n} drafts`;
    if (toggle.dataset.text !== text) {
      toggle.dataset.text = text;
      // Octicon git-pull-request-draft
      toggle.innerHTML = '<span class="gr-bot-icon gr-draft-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"/></svg></span><span class="gr-bot-text"></span><span class="gr-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg></span>';
      toggle.querySelector(".gr-bot-text").textContent = text;
    }
  }

  // ---------- 3. PR page ----------

  // `data-gr-mock-pull` is only used by the local prototype (file://), which has no /pull/N URL.
  const isPullPage = () => /\/pull\/\d+\/?$/.test(location.pathname) || root.hasAttribute("data-gr-mock-pull");

  // Header: title, state badge (Open/Merged...) and branches.
  // The badge is found by exact text + icon, near the <h1>, because the React
  // component's class changes with every deploy.
  const STATE_TEXT = /^(open|closed|merged|draft|aberto|fechado|mesclado|rascunho)$/i;

  // Text nodes whose content (without whitespace) matches `re`, outside markdown.
  // Going by text rather than tag works on both the old page (Rails:
  // <h3>, <summary>) and the new one (React: <span> inside buttons, etc.).
  function textNodes(scope, re) {
    const found = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => re.test(n.nodeValue.trim()) && !n.parentElement.closest(".markdown-body, #gr-toc, #gr-cockpit, #gr-panel, #gr-modal, script, style, [hidden]")
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    while (walker.nextNode()) found.push(walker.currentNode);
    return found;
  }

  // The large title. The new page also has a sticky header with the title in
  // small size; we keep the largest visible <h1>.
  function findTitle() {
    const all = [...document.querySelectorAll("main h1, .gh-header-title, h1[data-component='Heading']")]
      .filter((h) => !h.closest("#gr-toc"));
    if (all.length < 2) return all[0] || null;
    return all.reduce((a, b) => (b.getBoundingClientRect().height > a.getBoundingClientRect().height ? b : a));
  }

  function tagPrHeader() {
    const h1 = findTitle();
    if (!h1) return;
    tagPrNumber(h1);
    tagCopyLink(h1);
    h1.setAttribute("data-gr-pr-title", "");
    // Header = Primer's PageHeader (React) or the old .gh-header; otherwise, 4 levels up.
    let region = h1.closest('[data-component="PageHeader"], .gh-header, header');
    if (!region) {
      region = h1;
      for (let i = 0; i < 4 && region.parentElement; i++) region = region.parentElement;
    }
    markOnly("data-gr-pr-header", region);

    let pill = region.querySelector('[data-component="StateLabel"], .State');
    if (!pill) {
      // New page with the state as a button ("Draft ▾"): walk up from the text until the icon is found.
      const node = textNodes(region, STATE_TEXT)[0];
      let el = node?.parentElement;
      while (el && el !== region && !el.querySelector("svg")) el = el.parentElement;
      if (el && el !== region) pill = el.closest("button, a, [data-component]") || el;
    }
    if (pill) {
      const text = pill.textContent.trim().split(/\s+/)[0].toLowerCase();
      pill.setAttribute("data-gr-state-pill", "");
      pill.setAttribute("data-gr-pr-state", text);
    }
    for (const ref of region.querySelectorAll('[data-component="BranchName"], .commit-ref, a[href*="/tree/"]')) {
      ref.setAttribute("data-gr-branch", "");
    }
  }

  // Sidebar: find each section by its title (Reviewers, Labels...) and tag the
  // empty ones ("None yet", "No reviewers") so they collapse to a single line.
  const SIDEBAR_HEAD = /^(reviewers|assignees|labels|projects|milestone|development|deployments|revisores|responsáveis|etiquetas|projetos|marco|desenvolvimento)$/i;
  const SIDEBAR_EMPTY = /(no reviewers|no one|none yet|no milestone|no deployments|no branches or pull requests|nenhum|ainda não)/i;
  function tagSidebar() {
    // Titles found by text, not by tag: on the new page the title is a
    // <span>/<div> next to the gear button, and the old <h3> does not exist.
    const scope = document.querySelector("#partial-discussion-sidebar, [data-component='SplitPageLayout.Pane']") || document.querySelector("main") || document.body;
    const heads = textNodes(scope, SIDEBAR_HEAD).map((n) => n.parentElement);
    const headCount = (el) => heads.reduce((n, h) => n + (el.contains(h) ? 1 : 0), 0);
    for (const head of heads) {
      let section = head.closest("[data-gr-sb]");
      if (!section) {
        // Walk up while the ancestor contains only this section title.
        section = head;
        while (section.parentElement && section.parentElement !== scope &&
               section.parentElement !== document.body && headCount(section.parentElement) === 1) {
          section = section.parentElement;
        }
      }
      // The value is the section name ("reviewers", "labels"…), read by the cockpit.
      section.setAttribute("data-gr-sb", head.textContent.trim().toLowerCase());
      section.toggleAttribute("data-gr-empty", SIDEBAR_EMPTY.test(section.textContent));
    }
  }

  // PR number next to the title. On the new page it only appears in the sticky
  // header. If the title already shows a visible "#123", we just style it; otherwise,
  // we add our own button (at the end of the <h1>, after React's nodes).
  const prNumberFromUrl = () => location.pathname.match(/\/pull\/(\d+)/)?.[1] || root.getAttribute("data-gr-mock-pull") || undefined;
  function tagPrNumber(h1) {
    const ours = h1.querySelector(":scope > .gr-pr-num");
    const num = prNumberFromUrl();
    if (!settings.prNumber || !num) { ours?.remove(); return; }

    // "#123" already visible in the title or right after it (outside .sr-only)?
    const area = h1.parentElement || h1;
    // The text may be split across nodes ("#", "104"), so we compare the element's textContent.
    const visible = [...area.querySelectorAll("span, a, em")].find((el) =>
      /^#\s*\d+$/.test(el.textContent.trim()) && !el.closest(".sr-only, .gr-pr-num, [class*='VisuallyHidden']") && el.getClientRects().length > 0);
    if (visible) { ours?.remove(); visible.setAttribute("data-gr-pr-num", ""); return; }
    if (ours) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gr-pr-num";
    btn.textContent = `#${num}`;
    btn.title = "Copy #number (Shift: copy link)";
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.shiftKey ? location.origin + location.pathname.replace(/\/pull\/(\d+).*/, "/pull/$1") : `#${num}`;
      try { await navigator.clipboard.writeText(text); } catch {}
      btn.textContent = "copied";
      setTimeout(() => (btn.textContent = `#${num}`), 1200);
    });
    h1.appendChild(btn);
  }

  // Copy-link button next to the title (the sticky bar's one is hidden while the title is in view).
  function tagCopyLink(h1) {
    let btn = h1.querySelector(":scope > .gr-copy-link");
    if (btn) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gr-copy-link";
    btn.title = "Copy link";
    btn.setAttribute("aria-label", "Copy link");
    btn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path fill="currentColor" d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg>';
    btn.addEventListener("click", async (e) => {
      e.preventDefault(); e.stopPropagation();
      try { await navigator.clipboard.writeText(location.origin + location.pathname.replace(/\/pull\/(\d+).*/, "/pull/$1")); } catch {}
      btn.classList.add("gr-done");
      setTimeout(() => btn.classList.remove("gr-done"), 1200);
    });
    h1.appendChild(btn);
  }

  // Single header: while the PR title is in view, the sticky top bar does not
  // repeat the title. Preview, Code, bell and the two panel buttons become a single
  // "Actions" menu in the bar; GitHub's originals stay invisible beneath
  // our button (so their menus open there) and are triggered by the menu.
  const labelOf = (b) => [b.getAttribute("aria-label"),
    ...["aria-labelledby", "aria-describedby"].flatMap((k) => (b.getAttribute(k) || "").split(" ").map((id) => id && document.getElementById(id)?.textContent)),
    b.textContent].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  function headerParts() {
    const bar = document.querySelector('[class*="miniHeaderInner"]');
    const barActs = bar?.querySelector('[class*="actions__"]');
    const acts = document.querySelector('[class*="prc-PageLayout-HeaderContent"] [class*="prc-PageHeader-Actions-"]');
    const toggles = barActs ? [...barActs.querySelectorAll("button")].filter((x) => /panel/i.test(labelOf(x)) || x.matches("[data-docked-panel-toggle], [class*='panelToggle']")) : [];
    const find = (re) => acts && [...acts.querySelectorAll("button")].find((x) => re.test(labelOf(x)) || re.test(x.getAttribute("data-dd-action-name") || ""));
    return { bar, barActs, acts, toggles,
      preview: document.querySelector("[data-gr-preview-toggle]") || find(/preview/i),
      code: find(/^code\b/i), bell: find(/subscribe|notification/i),
      // Classic Conversation tab: "✨ Try the Overview page" switches to the new UI.
      overview: find(/try the overview page/i),
      review: barActs && [...barActs.querySelectorAll("button")].find((x) => /ReviewMenuButton/.test(x.className) || /^(submit )?review\b/i.test(labelOf(x))) };
  }

  let actionsMenu = null;
  function closeActionsMenu() { actionsMenu?.remove(); actionsMenu = null; }
  function openActionsMenu(anchor) {
    if (actionsMenu) return closeActionsMenu();
    const p = headerParts();
    const num = prNumberFromUrl();
    const base = location.origin + location.pathname.replace(/\/pull\/(\d+).*/, "/pull/$1");
    const item = (label, run, hint) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "gr-am-item";
      b.append(Object.assign(document.createElement("span"), { textContent: label }));
      if (hint) b.append(Object.assign(document.createElement("em"), { textContent: hint }));
      b.addEventListener("click", (e) => { e.stopPropagation(); closeActionsMenu(); run(); });
      return b;
    };
    const sep = () => Object.assign(document.createElement("hr"), { className: "gr-am-sep" });
    // Rare PR actions: GitHub's own buttons, wherever they are (the classic comment box and
    // sidebar may sit in our panel); only offered when the page has them.
    const open = !root.hasAttribute("data-gr-pr-done");
    const pageBtn = (re) => open && [...document.querySelectorAll("main button, main a, main summary, main [role='menuitem']")]
      .find((x) => !x.closest("#gr-cockpit, #gr-modal, .gr-am, .gr-ed, .gr-new, .gr-composer") && re.test((x.textContent || "").trim()));
    const [draft, archive, close] = [/^convert to draft$/i, /^archive pull request$/i, /^close pull request$/i].map(pageBtn);
    const danger = (b) => (b && b.classList.add("gr-am-danger"), b);
    const copy = async (t, b) => { try { await navigator.clipboard.writeText(t); } catch {} };
    const menu = document.createElement("div");
    menu.className = "gr-am"; menu.setAttribute("role", "menu");
    const add = (...xs) => xs.forEach((x) => x && menu.append(x));
    const [comments, panel] = [p.toggles.find((x) => /comment/i.test(labelOf(x))), p.toggles.find((x) => !/comment/i.test(labelOf(x)))];
    add(comments && item("Comments panel", () => comments.click()),
        panel && item("Activity panel", () => panel.click()),
        sep(),
        p.bell && item(/unsubscribe/i.test(labelOf(p.bell)) ? "Unsubscribe" : "Subscribe", () => p.bell.click(), "notifications"),
        num && item("Copy checkout command", () => copy(`gh pr checkout ${num}`), `gh pr checkout ${num}`),
        p.code && item("Open with…", () => p.code.click(), "Codespaces, Desktop"),
        p.review && root.hasAttribute("data-gr-pr-done") && item("Leave a review", () => p.review.click(), "comment only"),
        item("Download .patch", () => (location.href = `${base}.patch`)),
        item("Download .diff", () => (location.href = `${base}.diff`)),
        (draft || archive || close) && sep(),
        draft && item("Convert to draft", () => draft.click()),
        archive && danger(item("Archive pull request", () => archive.click())),
        close && danger(item("Close pull request", () => close.click())),
        (p.preview || p.overview) && sep(),
        p.preview && item("Switch to classic view", () => p.preview.click(), "Preview options"),
        p.overview && item("Switch to Overview page", () => p.overview.click(), "new view"));
    document.body.append(menu);
    const r = anchor.getBoundingClientRect();
    Object.assign(menu.style, { top: `${Math.round(r.bottom + 6)}px`, left: `${Math.round(Math.max(8, r.right - menu.offsetWidth))}px` });
    actionsMenu = menu;
  }
  document.addEventListener("mousedown", (e) => { if (actionsMenu && !actionsMenu.contains(e.target) && !e.target.closest?.(".gr-am-btn")) closeActionsMenu(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeActionsMenu(); });

  let headerRaf = 0;
  function syncHeader() {
    headerRaf = 0;
    const p = headerParts();
    const title = document.querySelector('[class*="prc-PageLayout-HeaderContent"] [class*="prc-PageHeader-TitleArea-"]') || document.querySelector("[data-gr-pr-title]");
    // Classic Conversation tab: no sticky bar, so the button sits on the title row
    // (inside the PageHeader, over GitHub's hidden buttons).
    const inline = !p.barActs && p.acts?.closest('[class*="prc-PageHeader-PageHeader-"]');
    const host = p.barActs || inline;
    const active = !!(settings.enabled && (isPullPage() || /\/pull\/\d+\/(changes|files|commits|checks)/.test(location.pathname)) && host);
    root.toggleAttribute("data-gr-actions-menu", active);
    root.toggleAttribute("data-gr-actions-inline", active && !p.barActs);
    // All PR tabs use the full width (Files changed pattern): no centered 1356px box.
    root.toggleAttribute("data-gr-fullpage", active);
    root.toggleAttribute("data-gr-pr-done", /^(merged|closed|mesclado|fechado)$/i.test(document.querySelector("[data-gr-pr-state]")?.getAttribute("data-gr-pr-state") || ""));
    // The sticky bar only appears after the title scrolls off screen (it takes no space:
    // it overlays the content). Until then, its buttons move down to the title row.
    const wide = innerWidth >= 768;
    // Desktop: bar only appears on scroll. Mobile: bar always visible (without repeating the title while it is in view).
    const one = active && !!p.bar && !!p.barActs && !!title && title.getBoundingClientRect().bottom > (wide ? 56 : p.bar.getBoundingClientRect().bottom + 4);
    root.toggleAttribute("data-gr-one-header", one);
    let btn = document.querySelector(".gr-am-btn");
    if (!active) { btn?.remove(); closeActionsMenu(); if (p.acts) p.acts.style.transform = ""; if (p.barActs) p.barActs.style.transform = ""; return; }
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button"; btn.className = "gr-am-btn";
      btn.innerHTML = 'Actions <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="m4.427 7.427 3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>';
      btn.setAttribute("aria-haspopup", "menu");
      btn.addEventListener("click", (e) => { e.stopPropagation(); openActionsMenu(btn); });
    }
    if (btn.parentElement !== host) host.append(btn);
    // Sticky bar with the same margins as the header/content (full width): GitHub
    // centers it in its own box, which does not line up with the content.
    const phEl = title?.closest('[class*="prc-PageHeader-PageHeader-"]');
    if (phEl && wide) {
      const r = phEl.getBoundingClientRect();
      root.style.setProperty("--gr-pad-l", `${Math.max(0, Math.round(r.left - 8))}px`);
      root.style.setProperty("--gr-pad-r", `${Math.max(0, Math.round(document.documentElement.clientWidth - r.right))}px`);
    }
    if (p.barActs) p.barActs.style.transform = "";
    if (one && wide) {
      const t = title.getBoundingClientRect(), a = p.barActs.getBoundingClientRect();
      const line = title.querySelector("h1, h2") || title;
      const l = line.getBoundingClientRect();
      // Horizontal: the buttons' right edge follows the header's right edge
      // (the sticky bar spans the full width and left the buttons stuck in the corner).
      const ph = title.closest('[class*="prc-PageHeader-PageHeader-"]') || title;
      const dx = Math.round(ph.getBoundingClientRect().right - a.right);
      p.barActs.style.transform = `translate(${dx}px, ${Math.round(l.top + Math.min(l.height, 32) / 2 - (a.top + a.height / 2))}px)`;
      root.style.setProperty("--gr-bar-acts-w", `${Math.round(a.width + 16)}px`);
    }
    // GitHub's originals: invisible, beneath our button.
    if (p.acts) {
      p.acts.style.transform = "";
      const a = p.acts.getBoundingClientRect(), b = btn.getBoundingClientRect();
      p.acts.style.transform = `translate(${Math.round(b.right - a.right)}px, ${Math.round(b.top + b.height / 2 - (a.top + a.height / 2))}px)`;
    }
  }
  const queueHeader = () => { if (!headerRaf) headerRaf = requestAnimationFrame(syncHeader); };
  addEventListener("scroll", queueHeader, { passive: true });
  addEventListener("resize", queueHeader);


  // Overview columns: find the container (content | sidebar) from the
  // sidebar sections, without relying on classes.
  // pane = largest ancestor of the sections that does not yet contain the description;
  // cols = its parent (contains both columns).
  // PR description: the first .markdown-body that is not in a GitHub side panel
  // (Comments/Activity come earlier in the DOM), in a comment, or in our own pieces.
  function descBody() {
    return [...document.querySelectorAll("main .markdown-body")]
      .find((b) => !b.closest('[class*="prc-PageLayout-SidebarWrapper-"], article, #gr-panel, #gr-modal, #gr-cockpit')) || null;
  }

  function tagLayout() {
    const secs = [...document.querySelectorAll("[data-gr-sb]")];
    const body = descBody();
    if (secs.length < 2 || !body) return;
    // Sidebar inside the panel's Details tab: keep the existing tags.
    if (secs.some((sec) => sec.closest("#gr-panel"))) return;

    let list = secs[0].parentElement;
    while (list && !secs.every((s) => list.contains(s))) list = list.parentElement;
    if (!list || list.contains(body)) return;
    let pane = list;
    while (pane.parentElement && !pane.parentElement.contains(body)) pane = pane.parentElement;
    const cols = pane.parentElement;
    if (!cols || cols === document.body || cols === root) return;

    markOnly("data-gr-pane", pane);
    markOnly("data-gr-cols", cols);
  }
  // Ensures a single element has the attribute (the page changes without reloading).
  function markOnly(attr, el) {
    for (const old of document.querySelectorAll(`[${attr}]`)) if (old !== el) old.removeAttribute(attr);
    el?.setAttribute(attr, "");
  }

  const STATUS_TEXT = /^(approvals?|aprovações)$/i;
  const PREVIEW_TEXT = /^preview$/i;

  // Merge box on the new Overview ("Some checks are waiting…" + Checks |
  // Comments | Approvals). From the "Approvals" text, walk up to the largest block that
  // does not yet contain the description.
  function tagMergeBox(scope) {
    const node = textNodes(scope, STATUS_TEXT).find((n) => !n.parentElement.closest("nav, [role='tablist'], #gr-cockpit"));
    const body = descBody();
    let el = node?.parentElement;
    // Classic page (Conversation tab): the merge box has a fixed id / test id, at the end
    // of the timeline. Only on open PRs: once merged or closed it is GitHub's own
    // "merged" card (restore/delete branch), which stays visible.
    if (!el) {
      const st = document.querySelector("[data-gr-pr-state]")?.getAttribute("data-gr-pr-state") || "open";
      return markOnly("data-gr-mergebox", /^(merged|closed|mesclado|fechado)$/i.test(st) ? null
        : document.querySelector("#partial-pull-merging, [data-testid='mergebox-partial']"));
    }
    if (!body) return markOnly("data-gr-mergebox", null);
    while (el.parentElement && el.parentElement !== scope && !el.parentElement.contains(body)) el = el.parentElement;
    markOnly("data-gr-mergebox", el);
  }

  // Description card: the first .markdown-body, walking up while the ancestor
  // has no other comments and no merge box.
  function tagDescription() {
    const body = descBody();
    if (!body) return markOnly("data-gr-desc", null);
    const box = document.querySelector("[data-gr-mergebox], #gr-cockpit");
    let el = body;
    while (el.parentElement && el.parentElement.querySelectorAll(".markdown-body").length === 1 &&
           !(box && el.parentElement.contains(box)) && !el.parentElement.matches("[data-gr-cols], main")) {
      el = el.parentElement;
    }
    markOnly("data-gr-desc", el);
  }

  // GitHub's "Preview ▾" selector (toggles the new UI): we highlight it
  // for anyone who wants to go back to the old one.
  function tagPreviewToggle() {
    const node = textNodes(document.querySelector("main") || document.body, PREVIEW_TEXT)
      // Not the Write | Preview tab of a comment box (classic Conversation tab).
      .find((n) => n.parentElement.closest("button, summary, [role='button']") && !n.parentElement.closest("form, [role='tablist'], [role='tab'], .js-previewable-comment-form"));
    const btn = node?.parentElement.closest("button, summary, [role='button']");
    markOnly("data-gr-preview-toggle", btn || null);
    if (btn && !btn.title) btn.title = "Open to switch back to the classic pull request page";
  }

  // Description table of contents: a floating button (our node, outside the React tree)
  // that lists the markdown headings and highlights the visible section.
  let tocObserver = null;
  function updateToc() {
    // React re-renders the description: always fetch the current headings (old ones
    // leave the page and scrollIntoView on them does nothing).
    const currentHeads = () => {
      const body = document.querySelector("[data-gr-desc] .markdown-body") || descBody();
      return body ? [...body.querySelectorAll("h1, h2, h3")] : [];
    };
    const heads = isPullPage() && settings.toc ? currentHeads() : [];
    let toc = document.getElementById("gr-toc");
    if (heads.length < 2) { toc?.remove(); tocObserver?.disconnect(); return; }

    const key = heads.map((h) => h.textContent.trim()).join("|");
    if (toc?.dataset.key === key && toc.grHeads?.every((h) => h.isConnected)) return;
    toc?.remove();
    tocObserver?.disconnect();

    toc = document.createElement("div");
    toc.id = "gr-toc";
    toc.dataset.key = key;
    toc.innerHTML = `<nav class="gr-toc-panel"><b>In this description</b></nav>
      <button type="button" class="gr-toc-pill"><span>☰</span> Contents <em></em></button>`;
    toc.querySelector(".gr-toc-pill em").textContent = heads.length;
    const panel = toc.querySelector("nav");
    const items = heads.map((h) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "gr-toc-item";
      item.dataset.level = h.tagName[1];
      item.textContent = h.textContent.trim();
      item.addEventListener("click", () => {
        const i = items.indexOf(item);
        const target = h.isConnected ? h : currentHeads()[i];
        if (!target) return;
        // scrollIntoView works even if the page scrolls inside a container;
        // the margin offsets GitHub's sticky header, which would cover the heading.
        target.style.scrollMarginTop = "96px";
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        toc.removeAttribute("data-open");
      });
      panel.appendChild(item);
      return item;
    });
    items[0].setAttribute("data-active", "");
    toc.querySelector(".gr-toc-pill").addEventListener("click", () => toc.toggleAttribute("data-open"));
    toc.grHeads = heads;
    document.body.appendChild(toc);

    tocObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        items.forEach((it, i) => it.toggleAttribute("data-active", heads[i] === e.target));
      }
    }, { rootMargin: "-80px 0px -70% 0px" });
    heads.forEach((h) => tocObserver.observe(h));
  }

  // Net line count next to "+52 −6": how much code the PR actually adds.
  function tagNetDiff() {
    const scope = document.querySelector('[class*="prc-PageLayout-HeaderContent"], [data-gr-pr-header]');
    let net = document.querySelector(".gr-net");
    // Leaf elements with "+52" and "−6" (text may be split across nodes, so we use textContent).
    const leaves = scope ? [...scope.querySelectorAll("span, strong, div, a")].filter((e) => !e.closest(".gr-net, .sr-only, [class*='VisuallyHidden']") && e.getClientRects().length && ![...e.children].some((c) => c.textContent.trim())) : [];
    const plusEl = leaves.find((e) => /^\+\s*[\d,]+$/.test(e.textContent.trim()));
    const minusEl = leaves.find((e) => /^[-−–]\s*[\d,]+$/.test(e.textContent.trim()));
    if (!plusEl || !minusEl) { net?.remove(); return; }
    const n = (e) => +e.textContent.replace(/[^\d]/g, "");
    const add = n(plusEl), del = n(minusEl), diff = add - del;
    // After the diffstat squares, if present; otherwise right after the "−6".
    let after = minusEl;
    for (let el = minusEl.nextElementSibling; el; el = el.nextElementSibling) after = el;
    if (minusEl.parentElement !== plusEl.parentElement && minusEl.parentElement?.nextElementSibling === null) after = minusEl.parentElement;
    if (!net) { net = document.createElement("span"); net.className = "gr-net"; }
    net.textContent = `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff).toLocaleString("en-US")} net`;
    net.title = `${add} added − ${del} removed = ${diff} lines`;
    net.dataset.sign = diff > 0 ? "up" : diff < 0 ? "down" : "zero";
    if (after.nextElementSibling !== net) after.after(net);
  }


  // Blocks that only clutter the Overview: the "Looking for an old friend?" notice and the
  // sidebar's "Activity (since you last interacted)" section (full Activity remains in the top button).
  function tagNoise(scope) {
    const mark = (re, attr, stop) => {
      const n = textNodes(scope, re)[0];
      let el = n?.parentElement;
      if (!el) return;
      while (el.parentElement && el.parentElement !== scope && !stop(el.parentElement)) el = el.parentElement;
      markOnly(attr, el);
    };
    mark(/^Looking for an old friend\?$/i, "data-gr-oldfriend", (p) => p.querySelectorAll("a").length > 4 || !!p.querySelector("[data-gr-desc], #gr-cockpit"));
    mark(/^Activity \(since you last interacted\)$/i, "data-gr-activity", (p) => !!p.querySelector("[data-gr-sb]") || p.matches("[data-testid='sticky-sidebar']"));
  }

  function tagPullPage() {
    const scope = document.querySelector("main") || document.body;
    tagPrHeader();
    tagSidebar();
    tagLayout();
    tagMergeBox(scope);
    tagDescription();
    tagPreviewToggle();
    tagNoise(scope);
    tagNetDiff();
    GRCockpit.update({ settings, root, textNodes });
    updateToc();
    queueHeader();
  }

  // GitHub dialogs (e.g. "Some checks were not successful" when clicking the checks
  // status in the list) open as a right-side drawer, same pattern as conversations.
  // Only tags the node (React still owns it); CSS does the rest.
  function tagDrawerDialogs() {
    for (const d of document.querySelectorAll("[role='dialog']:not([data-gr-drawer]), dialog.Overlay:not([data-gr-drawer])")) {
      if (d.closest("#gr-modal, #gr-panel, [class*='prc-PageLayout-SidebarWrapper-']") || d.querySelector("[role='menu'], [role='listbox']")) continue;
      const head = (document.getElementById(d.getAttribute("aria-labelledby") || "")?.textContent
        || d.querySelector("h1, h2, h3, [class*='Title'], [class*='title']")?.textContent || d.getAttribute("aria-label") || "").trim();
      // checks, merge queue entry status ("Queue entry status details"), stacked PRs ("Stack #19177")
      if (/\bchecks?\b|status details|^stack\b/i.test(head) || /^entry-status-dialog/.test(d.id)) d.setAttribute("data-gr-drawer", "");
    }
  }

  // Drawer dialogs close on a click outside them (GitHub's dialogs only close from their
  // own button; centered, that was fine, as a side drawer the page invites the click).
  document.addEventListener("mousedown", (e) => {
    const d = [...document.querySelectorAll("[data-gr-drawer]")].find((x) => x.matches("dialog") ? x.open : x.offsetParent !== null || getComputedStyle(x).position === "fixed");
    if (!d || e.button !== 0) return;
    const r = d.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    // Menus and tooltips opened from the drawer live outside it (top layer / portals).
    if (inside || e.target.closest?.("[role='menu'], [role='listbox'], [popover]:not([data-gr-drawer]), #__primerPortalRoot__")) return;
    const close = d.querySelector("[data-close-dialog-id], button[aria-label='Close'], button[aria-label='Close dialog']");
    close?.click();
    // GitHub's button normally closes it; if it is still open right after, close the <dialog> itself.
    setTimeout(() => { if (d.matches("dialog") && d.open) d.close(); }, 60);
    e.preventDefault();
  }, true);

  // Merge status panel: tag each check group's type (marker color) and
  // the "Merging is blocked" message that only repeats what another section already said.
  const CHECK_KIND = [[/fail|error|cancel/i, "fail"], [/pending|expected|queued|waiting/i, "pending"], [/in progress|running/i, "progress"],
    [/skipped/i, "skipped"], [/neutral/i, "neutral"], [/success/i, "success"]];
  // "Merge when ready" / merge queue / auto-merge: GitHub replaces the whole panel
  // with a screen containing only "Confirm …" and "Cancel". This step is reversible (you can
  // remove it from the queue or turn off auto-merge), so we confirm automatically right after
  // the user's click. Direct merge (irreversible) still asks for confirmation.
  const QUEUE_BTN = /^(merge when ready|add to merge queue|enable auto-merge.*)$/i;
  const QUEUE_CONFIRM = /^confirm (merge when ready|add to merge queue|auto-merge.*)$/i;
  let queueClickAt = 0;
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("button");
    if (b && e.isTrusted && QUEUE_BTN.test((b.textContent || "").trim())) queueClickAt = Date.now();
  }, true);
  function autoConfirmQueue() {
    if (!queueClickAt || Date.now() - queueClickAt > 5000) return;
    const c = [...document.querySelectorAll("button")].find((b) => QUEUE_CONFIRM.test((b.textContent || "").trim()) && !b.disabled);
    if (!c) return;
    queueClickAt = 0;
    c.click();
  }

  function tagMergePanel() {
    autoConfirmQueue();
    // Reviewers ("1 approval", "1 pending review"): GitHub only shows names when
    // expanded. We expand each group once, to see who approved without clicking.
    for (const g of document.querySelectorAll("[class*='reviewerGroupsContainer'] button[class*='groupHeadingButton'][aria-expanded='false']:not([data-gr-auto])")) {
      g.setAttribute("data-gr-auto", "");
      g.click();
    }
    for (const b of document.querySelectorAll("button[class*='checksGroupHeadingButton']")) {
      const t = b.textContent || "";
      const kind = CHECK_KIND.find(([re]) => re.test(t))?.[1] || "neutral";
      if (b.getAttribute("data-gr-cg") !== kind) b.setAttribute("data-gr-cg", kind);
    }
    for (const box of document.querySelectorAll("[data-testid='mergebox-border-container']")) {
      const said = new Set([...box.querySelectorAll("section p")].map((p) => p.textContent.trim()).filter(Boolean));
      for (const li of box.querySelectorAll("li[class*='BlockedSectionMessage']")) li.toggleAttribute("data-gr-dup", said.has(li.textContent.trim()));
    }
  }

  // Merge queue page (/queue/<branch>): status of each visible entry as a
  // badge (GitHub only shows an icon with a tooltip).
  function tagQueuePage() {
    const on = /\/queue\/[^/]+/.test(location.pathname);
    root.toggleAttribute("data-gr-queue", on);
    if (!on) return;
    for (const b of document.querySelectorAll(".hx_merge_queue_entry_status_icon")) {
      const t = (b.getAttribute("aria-labelledby") || "").split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ")
        || (b.id && document.querySelector(`tool-tip[for="${CSS.escape(b.id)}"]`)?.textContent?.trim())
        || b.getAttribute("aria-label") || b.getAttribute("title") || "";
      if (t && b.getAttribute("data-gr-label") !== t) b.setAttribute("data-gr-label", t);
      if (t && b.title !== t) b.title = t;
    }
    groupQueueByEstimate();
  }

  // Merge queue: entries grouped by their estimated merge time ("Next 30 minutes",
  // "Within an hour"…). GitHub lists them in merge order, so each group is one run of
  // rows; a small header (our own <li>, the list is server-rendered) opens each run.
  const QUEUE_BUCKETS = [[30, "Next 30 minutes"], [60, "Within an hour"], [120, "1–2 hours"], [Infinity, "More than 2 hours"]];
  const estimateMinutes = (row) => {
    const m = row.textContent.replace(/\s+/g, " ").match(/Estimated merge in\s+((?:\d+\s*[dhms]\s*)+)/i);
    if (!m) return null;
    let min = 0;
    for (const [, n, u] of m[1].matchAll(/(\d+)\s*([dhms])/g)) min += +n * { d: 1440, h: 60, m: 1, s: 1 / 60 }[u];
    return min;
  };
  function groupQueueByEstimate() {
    for (const list of new Set([...document.querySelectorAll("main .hx_merge_queue_entry_status_icon")].map((b) => b.closest("ul")).filter(Boolean))) {
      const rows = [...list.children].filter((li) => li.matches("li:not(.gr-queue-group)"));
      const labels = rows.map((r) => { const m = estimateMinutes(r); return m == null ? "No estimate" : QUEUE_BUCKETS.find(([max]) => m <= max)[1]; });
      // Same groups as last time: leave the page alone (our own inserts re-trigger the observer).
      const sig = labels.join("|");
      if (list.getAttribute("data-gr-queue-sig") === sig && list.querySelector(":scope > .gr-queue-group")) continue;
      list.querySelectorAll(":scope > .gr-queue-group").forEach((g) => g.remove());
      list.setAttribute("data-gr-queue-sig", sig);
      // Only worth it with more than one group.
      if (new Set(labels).size < 2) continue;
      rows.forEach((row, i) => {
        if (i > 0 && labels[i] === labels[i - 1]) return;
        let n = 0;
        for (let j = i; j < rows.length && labels[j] === labels[i]; j++) n++;
        const head = document.createElement("li");
        head.className = "gr-queue-group";
        head.setAttribute("role", "presentation");
        head.append(Object.assign(document.createElement("span"), { textContent: labels[i] }),
          Object.assign(document.createElement("span"), { className: "gr-queue-n", textContent: String(n) }));
        row.before(head);
      });
    }
  }

  function tag() {
    if (!settings.enabled) {
      document.getElementById("gr-toc")?.remove();
      document.querySelectorAll(".gr-pr-num, .gr-copy-link, .gr-net, .gr-queue-group, .gr-stack-head").forEach((el) => el.remove());
      document.querySelectorAll("[data-gr-queue-sig]").forEach((el) => el.removeAttribute("data-gr-queue-sig"));
      GRCockpit.update({ settings, root, textNodes });
      syncHeader();
      return;
    }
    observer.disconnect(); // don't react to our own changes
    try {
      tagDrawerDialogs();
      tagQueuePage();
      tagMergePanel();
      if (isPullPage()) tagPullPage();
      else { if (/\/pull\/\d+\//.test(location.pathname)) queueHeader(); // Files changed, Commits, Checks: same header
        tagListRows(); preferCompact(); tagStateFilter(); updateToc(); GRCockpit.update({ settings, root, textNodes }); } // outside Overview: tears down cockpit/modal
    } finally {
      observe();
    }
  }

  observe();
  document.addEventListener("turbo:load", scheduleTag);
  window.addEventListener("popstate", scheduleTag);
})();
// Loaded version (to check in the console whether the extension was reloaded).
document.documentElement.setAttribute("data-gr-version", chrome.runtime?.getManifest?.().version || "dev");
