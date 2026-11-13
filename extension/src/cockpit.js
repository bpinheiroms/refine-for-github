/* GitHub Refine — PR Overview as "what is left before merge"
 *
 * Two pieces of ours, built only from what is already on the page (no API, no token):
 *
 *   #gr-cockpit  (main column, before the merge box)
 *     verdict + list of pending items with the action for each: checks (with the
 *     list of failed ones), unresolved conversations, approval, conflicts;
 *     in the footer, the page's own merge buttons (they trigger the originals).
 *
 *   #gr-panel    (right column, in place of the sidebar)
 *     code conversations and comments. Clicking opens a modal (#gr-modal) with
 *     a copy of the whole conversation (diff snippet + replies) and a button
 *     to go to the original, where you can reply.
 *
 * Where each piece of data comes from:
 *   - conversations: `.js-resolvable-timeline-thread-container[data-resolved]`;
 *   - comments: `.comment-body` outside the description and conversations;
 *   - checks: merge box rows with "Failing after…", "Successful in…";
 *   - approval: reviewers' aria-label ("X approved these changes");
 *   - conflicts and merge: merge box texts and buttons.
 * Anything not found simply does not show up (no guessing).
 *
 * The original page loses nothing: the CSS only hides the merge box and the
 * sidebar (data-gr-* attributes), and "Show original Overview" undoes it.
 */
const GRCockpit = (() => {
  const root = document.documentElement;
  let el = null, panel = null;
  let renderedSig = null, panelSig = null;
  let refs = { threads: [], comments: [] }; // original elements, for the modal
  let expandedChecks = null;                // path where we already opened the checks list
  // The "N things left before merging" summary is off: GitHub's own merge box stays in
  // its place. The page is still read (the panel needs the conversations and comments).
  const SHOW_SUMMARY = false;

  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const text = (node) => clean(node?.textContent);
  const plural = (n, one, many) => (n === 1 ? one : many);
  const names = (list) => list.length <= 2 ? list.join(" and ") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
  const displayName = (login) => ({ "copilot-pull-request-reviewer": "Copilot", "github-actions": "GitHub Actions" })[login] || login.replace(/\[bot\]$/, "");
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  function ago(iso) {
    if (!iso) return "";
    const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000));
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
  }

  // ---------- page reading ----------

  // Comment title: the first **bold** of the first block with text,
  // otherwise the block itself. Skips signatures in <sub> ("Automated review by…").
  function commentTitle(body) {
    if (!body) return "";
    for (const block of body.querySelectorAll(":scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > ul > li, :scope > ol > li")) {
      if (block.matches("p") && block.children.length === 1 && block.firstElementChild.matches("sub")) continue;
      const t = text(block);
      if (!t) continue;
      const strong = block.querySelector("strong, b");
      const pick = strong && t.startsWith(text(strong).slice(0, 8)) ? text(strong) : t;
      return cut(pick.replace(/^\[[^\]]+\]\s*/, ""), 140);
    }
    return cut(text(body), 140);
  }

  // Author of the last message in the conversation (to highlight when someone else replied).
  const lastAuthor = (t, q, viewer) => { const all = [...t.querySelectorAll(q)].map(text).filter(Boolean); return all.length > 1 ? who(all[all.length - 1], viewer) : ""; };
  const who = (login, viewer) => (!login ? "?" : login === viewer ? "you" : displayName(login));

  // Resolved conversations arrive collapsed: GitHub only fetches the content on
  // expand (data-deferred-content-url, same origin, user session).
  // We fetch the same fragment once and place it where GitHub would.
  const hydrated = new Set();
  function hydrateCollapsed() {
    for (const t of document.querySelectorAll(".js-resolvable-timeline-thread-container[data-deferred-content-url]")) {
      const url = t.getAttribute("data-deferred-content-url");
      if (hydrated.has(url) || t.querySelector(".comment-body, .js-comment-body")) continue;
      hydrated.add(url);
      fetch(url, { credentials: "same-origin", headers: { Accept: "text/html" } })
        .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((html) => {
          const body = t.querySelector("[data-target='review-thread-collapsible.body']") || t;
          // DOMParser: inert document (no scripts run), and no innerHTML. The leading <body> keeps
          // a fragment that starts with <template>/<style>/<link> in the body instead of the head.
          const doc = new DOMParser().parseFromString(`<body>${html}`, "text/html");
          doc.querySelectorAll("script").forEach((n) => n.remove());
          // GitHub's HTML has no inline handlers (CSP); drop any so nothing runs on insert.
          doc.querySelectorAll("*").forEach((n) => [...n.attributes].forEach((a) => /^on/i.test(a.name) && n.removeAttribute(a.name)));
          const frag = document.createDocumentFragment();
          frag.append(...doc.body.childNodes);
          const slot = body.querySelector("include-fragment");
          if (slot) slot.replaceWith(frag); else body.append(frag);
        })
        .catch(() => {});
    }
  }

  // New Overview (React): each conversation is an <article> with no id inside the review,
  // with the file path in a mono link in the title and "Line N" next to it.
  const NEW_THREAD = "main article:not([id]):has(> div h2 a.text-mono)";
  const isNewThread = (t) => t.matches("article:not([id])");
  const threadResolved = (t) => isNewThread(t)
    ? !!t.querySelector(":scope > div [aria-label^='Unresolve conversation']") || [...t.querySelectorAll(":scope > div [data-component='Label']")].some((l) => /^resolved$/i.test(text(l)))
    : t.getAttribute("data-resolved") !== "false";

  function readNewThread(t, i, viewer) {
    const head = t.querySelector(":scope > div h2");
    const path = text(head?.querySelector("a.text-mono")).replace(/[\u200e\u200f]/g, "");
    const line = ([...(head?.querySelectorAll("span") || [])].map(text).find((x) => /^Line \d+/i.test(x)) || "").replace(/^Line /i, "");
    const bodies = t.querySelectorAll(".markdown-body");
    const login = text(t.querySelector("[data-testid='avatar-link']"));
    const resolver = text([...t.querySelectorAll("span")].find((x) => /^\s*\S+ marked this conversation as resolved/.test(x.textContent))?.querySelector("b"));
    return {
      i,
      resolved: threadResolved(t),
      loc: `${path}${line ? ":" + line : ""}`,
      // Resolved ones arrive collapsed (the text only appears on expand).
      title: commentTitle(bodies[0]) || (resolver ? `Resolved by ${who(resolver, viewer)}` : "Open to read"),
      who: login ? who(login, viewer) : "",
      avatar: t.querySelector("img[alt^='@']")?.getAttribute("src") || null,
      when: ago(t.querySelector("relative-time")?.getAttribute("datetime")),
      replies: Math.max(0, bodies.length - 1),
      lastWho: lastAuthor(t, "[data-testid='avatar-link']", viewer),
      outdated: [...t.querySelectorAll(":scope > div [data-component='Label']")].some((l) => /^outdated$/i.test(text(l))),
    };
  }

  function readThreads(viewer) {
    // The same conversation can appear twice (timeline + GitHub "Comments" panel
    // open): we deduplicate by the conversation link (#r123…).
    const keyOf = (t) => t.querySelector(":scope > div h2 a[href*='#r'], a[href*='#r']")?.getAttribute("href")?.split("#")[1] || t;
    const seenT = new Set();
    const fresh = [...document.querySelectorAll(NEW_THREAD)].filter((t) => { const k = keyOf(t); if (seenT.has(k)) return false; seenT.add(k); return true; });
    if (fresh.length) {
      refs.threads = fresh;
      const list = fresh.map((t, i) => readNewThread(t, i, viewer));
      return { open: list.filter((t) => !t.resolved), resolved: list.filter((t) => t.resolved) };
    }
    const all = [...document.querySelectorAll(".js-resolvable-timeline-thread-container[data-resolved]")];
    refs.threads = all;
    const list = all.map((t, i) => {
      const lines = t.querySelectorAll("td[data-line-number]");
      const line = lines.length ? lines[lines.length - 1].getAttribute("data-line-number") : "";
      return {
        i,
        resolved: t.getAttribute("data-resolved") !== "false",
        loc: `${text(t.querySelector("a.text-mono, .text-mono"))}${line ? ":" + line : ""}`,
        title: commentTitle(t.querySelector(".comment-body, .js-comment-body")) || "Loading…",
        who: text(t.querySelector("a.author")) ? who(text(t.querySelector("a.author")), viewer) : "",
        avatar: t.querySelector("img.avatar")?.getAttribute("src") || null,
        when: ago(t.querySelector("relative-time")?.getAttribute("datetime")),
        replies: Math.max(0, t.querySelectorAll(".comment-body, .js-comment-body").length - 1),
        lastWho: lastAuthor(t, "a.author", viewer),
        outdated: [...t.querySelectorAll(".Label, .label, .State")].some((l) => /^outdated$/i.test(text(l))),
      };
    });
    return { open: list.filter((t) => !t.resolved), resolved: list.filter((t) => t.resolved) };
  }

  // General comments: comment bodies outside the description and conversations.
  function readComments(viewer) {
    const seen = new Set();
    const out = [];
    // Classic: .comment-body. New Overview (React): article#issuecomment-… with .markdown-body.
    for (const body of document.querySelectorAll("main .comment-body, main .js-comment-body, main article:is([id^='issuecomment-'], [id^='pullrequestreview-']) .markdown-body")) {
      if (body.closest("[data-gr-desc], .js-resolvable-timeline-thread-container, #gr-cockpit, #gr-panel")) continue;
      // The new-comment form (classic) has its own preview .comment-body: it is not a comment.
      if (body.closest(".js-preview-body, #issue-comment-box, .timeline-new-comment, form.js-new-comment-form, [aria-label='Add comment form']")) continue;
      const box = body.closest("article:is([id^='issuecomment-'], [id^='pullrequestreview-']), [id^='issuecomment-'], .timeline-comment-group, .TimelineItem") || body.parentElement;
      if (box.matches("article") && body.closest("article") !== box) continue; // conversation inside the review
      const key = box.id || box;
      if (seen.has(box) || seen.has(key)) continue;
      seen.add(box); seen.add(key);
      out.push(box);
    }
    refs.comments = out;
    return out.map((box, i) => ({
      i,
      who: who(["a.author", "[data-testid='avatar-link']", "a[data-hovercard-type='user']", "a[data-hovercard-type='bot']"]
        .map((q) => text(box.querySelector(q))).find(Boolean) || "", viewer),
      avatar: box.querySelector("img.avatar, img[alt^='@']")?.getAttribute("src") || null,
      when: ago(box.querySelector("relative-time")?.getAttribute("datetime")),
      title: commentTitle(box.querySelector(".comment-body, .js-comment-body, .markdown-body")),
    }));
  }

  // Rows of the checks list in the merge box ("CI / check (pull_request)  Failing after 3s  Required").
  const CHECK_STATUS = /^(failing|failed|successful|cancelled|canceled|skipped|queued|in progress|pending|expected|waiting|neutral|action required|timed out|started)\b/i;
  function readCheckRows(mergebox, textNodes) {
    if (!mergebox) return [];
    const nodes = textNodes(mergebox, CHECK_STATUS).map((n) => n.parentElement);
    const count = (e) => nodes.filter((n) => e.contains(n)).length;
    const rows = new Map();
    for (const n of nodes) {
      let row = n;
      while (row.parentElement && row.parentElement !== mergebox && count(row.parentElement) === 1) row = row.parentElement;
      if (row === n) continue;
      const status = text(n);
      const link = [...row.querySelectorAll("a[href]")].find((a) => text(a) && !CHECK_STATUS.test(text(a)));
      const name = link ? text(link) : clean(text(row).replace(status, "").replace(/\bRequired\b/, ""));
      if (!name || rows.has(name)) continue;
      rows.set(name, {
        name: cut(name, 80), status,
        st: /^(failing|failed|cancelled|canceled|timed out|action required)/i.test(status) ? "bad" : /^(successful|skipped|neutral)/i.test(status) ? "ok" : "warn",
        required: /\bRequired\b/.test(text(row)),
        href: link?.getAttribute("href") || null,
      });
    }
    return [...rows.values()];
  }

  // Merge buttons from the original box ("Resolve conflicts", "Enable auto-merge (squash)"…).
  const MERGE_ACTION = /merge|conflict|update branch|rebase|ready for review|approve|reopen/i;
  function readMergeActions(mergebox) {
    if (!mergebox) return [];
    const seen = new Set();
    return [...mergebox.querySelectorAll("button, a[href]")]
      .map((b) => text(b))
      .filter((t) => t.length > 2 && t.length < 40 && MERGE_ACTION.test(t) && !/^merge conflicts$/i.test(t) && !seen.has(t) && seen.add(t));
  }

  // Text of a cell in the new merge box ("Checks 1 required failing, 1 failing").
  function cell(scope, label, textNodes) {
    const node = textNodes(scope, new RegExp(`^${label}$`, "i"))[0];
    let e = node?.parentElement;
    while (e && e !== scope && text(e).length <= label.length + 1) e = e.parentElement;
    return e && e !== scope ? { text: text(e).replace(new RegExp(`^${label}\\s*`, "i"), ""), el: e } : null;
  }

  function sidebarSection(name) {
    return [...document.querySelectorAll("[data-gr-sb]")].find((s) => s.getAttribute("data-gr-sb") === name) || null;
  }

  function readPage(textNodes) {
    const viewer = document.querySelector('meta[name="user-login"]')?.content || "";
    const prState = document.querySelector("[data-gr-pr-state]")?.getAttribute("data-gr-pr-state") || "open";
    const base = [...document.querySelectorAll("[data-gr-branch]")].map((b) => text(b).split(":").pop())[0] || "the base branch";
    const prUrl = location.pathname.replace(/\/$/, "");
    const mergebox = document.querySelector("[data-gr-mergebox]");
    const scopeText = text(mergebox);
    const items = [];

    if (/^(draft|rascunho)$/.test(prState)) {
      items.push({ st: "warn", title: "Pull request is a draft", sub: "Reviewers aren't notified until it's ready.",
        act: [{ label: "Ready for review", click: "^ready for review$" }] });
    }

    // Checks. The detailed list only exists once opened: we open it once.
    const checksCell = mergebox && cell(mergebox, "Checks", textNodes);
    let rows = readCheckRows(mergebox, textNodes);
    // (Only while the summary is shown: GitHub's own merge box is on screen now, so it is left as the user set it.)
    if (SHOW_SUMMARY && !rows.length && checksCell && expandedChecks !== location.pathname) {
      expandedChecks = location.pathname;
      (checksCell.el.closest("button, [role='button']") || checksCell.el.querySelector("button, [role='button']") || checksCell.el).click();
    }
    const checks = checksCell?.text || "";
    const failingN = [...checks.matchAll(/(\d+)\s+(?:required\s+)?failing/gi)].reduce((a, m) => a + +m[1], 0);
    const failedRows = rows.filter((r) => r.st === "bad");
    // Read from a single text node: in the cell's joined text the neighboring counter sticks to the number ("4" + "4 workflows" = "44").
    const RUNS = /^\s*(\d+)\s+workflows?\s+(?:approvals?\s+pending|awaiting approval|runs? awaiting)/i;
    const runsNode = mergebox && textNodes(mergebox, RUNS)[0];
    const runs = runsNode ? runsNode.nodeValue.match(RUNS) : `${checks} ${scopeText}`.match(/\b(\d+)\s+workflows?\s+(?:approvals?\s+pending|awaiting approval|runs? awaiting)/i);
    if (failingN || failedRows.length || /some checks were not successful/i.test(scopeText)) {
      const n = Math.max(failingN, failedRows.length);
      const req = failedRows.filter((r) => r.required).length || +(checks.match(/(\d+)\s+required\s+failing/i)?.[1] || 0);
      items.push({ st: "bad", title: n ? `${n} failing ${plural(n, "check", "checks")}${req ? ` (${req} required)` : ""}` : "Checks failed",
        checks: rows, act: [{ label: "View checks", href: `${prUrl}/checks` }] });
    } else if (runs || /waiting for approval|requires approval from a maintainer/i.test(scopeText)) {
      const n = runs ? +runs[1] : 0;
      items.push({ st: "warn", title: n ? `${n} ${plural(n, "workflow", "workflows")} awaiting approval` : "Workflows awaiting approval",
        sub: "Fork contribution: CI runs only after a maintainer approves.", checks: rows,
        act: [{ label: "Approve and run", primary: true, click: "approve( and run)? workflows?( to run)?|approve and run" }] });
    } else if (rows.some((r) => r.st === "warn") || /in progress|pending|queued|expected|haven.t completed/i.test(checks)) {
      items.push({ st: "warn", title: "Checks running", sub: checks, checks: rows, act: [{ label: "View checks", href: `${prUrl}/checks` }] });
    } else if (rows.length || /passed|successful|all checks/i.test(`${checks} ${scopeText}`)) {
      items.push({ st: "ok", title: rows.length ? `${plural(rows.length, "Check passed", `All ${rows.length} checks passed`)}` : "Checks passed" });
    }

    // Conversations: only in the panel (Unresolved tab), not repeated in the cockpit.
    const threads = readThreads(viewer);

    // Approval
    const reviewers = sidebarSection("reviewers");
    const labels = [...(reviewers?.querySelectorAll("[aria-label]") || [])].map((e) => e.getAttribute("aria-label"));
    const pick = (re) => [...new Set(labels.map((l) => l.match(re)?.[1]).filter(Boolean).map((l) => who(l, viewer)))];
    const approved = pick(/^(.+?) approved these changes$/i);
    const changes = pick(/^(.+?) requested changes$/i);
    const commented = pick(/^(.+?) left review comments$/i);
    const awaiting = pick(/^Awaiting requested review from (.+)$/i);
    const approvalsText = `${(mergebox && cell(mergebox, "Approvals", textNodes))?.text || ""} ${scopeText} ${text(reviewers)}`;
    const notRequired = /at least 0 approving/i.test(approvalsText);
    const reviewAct = [{ label: "Review", href: `${prUrl}/files` }];
    if (changes.length || /changes requested/i.test(approvalsText)) {
      items.push({ st: "bad", title: changes.length ? `Changes requested by ${names(changes)}` : "Changes requested", act: reviewAct });
    } else if (approved.length) {
      items.push({ st: "ok", title: `Approved by ${names(approved)}` });
    } else if (!notRequired && /review required|approving reviews? (?:is|are) required/i.test(approvalsText)) {
      items.push({ st: "warn", title: "Approval required", sub: awaiting.length ? `Waiting on ${names(awaiting)}.` : "", act: reviewAct });
    } else if (reviewers || mergebox) {
      const sub = [commented.length ? `${names(commented)} commented, nobody approved yet.` : "",
        awaiting.length ? `Waiting on ${names(awaiting)}.` : "", notRequired ? `${base} doesn't require approval.` : ""].filter(Boolean).join(" ");
      items.push({ st: "todo", title: "No approvals yet", sub, act: reviewAct });
    }

    // Conflicts
    if (/merge conflicts|has conflicts|conflicts must be resolved|resolve conflicts/i.test(scopeText)) {
      items.push({ st: "bad", title: `Conflicts with ${base}`, sub: "Resolve them before merging.", act: [{ label: "Resolve conflicts", primary: true, click: "^resolve conflicts$", href: `${prUrl}/conflicts` }] });
    } else if (/no conflicts with the base branch/i.test(scopeText)) {
      items.push({ st: "ok", title: `No conflicts with ${base}` });
    }

    const people = [...new Map([...(reviewers?.querySelectorAll("img[alt^='@']") || [])]
      .map((img) => { const login = img.alt.slice(1); return [login, { name: who(login, viewer), avatar: img.getAttribute("src") }]; })).values()];
    const labelChips = [...(sidebarSection("labels")?.querySelectorAll("a[href*='/labels/'], a[href*='label%3A'], a[href*='label:']") || [])]
      .map((a) => ({ name: text(a), color: getComputedStyle(a).backgroundColor })).filter((l) => l.name);

    return {
      prState, items, people, labels: labelChips,
      mergeActions: readMergeActions(mergebox).filter((t) => !/^resolve conflicts$/i.test(t) || !items.some((i) => /^Conflitos/.test(i.title))),
      hasMergebox: !!mergebox,
      threads, comments: readComments(viewer),
    };
  }

  // ---------- rendering ----------

  function h(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "class") n.className = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) n.append(k.nodeType ? k : String(k));
    return n;
  }

  // Triggers a button on the original (hidden) page by its text.
  function clickOriginal(pattern) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, "i");
    const btn = [...document.querySelectorAll("main button, main a, main summary, main [role='button'], main [role='menuitem']")]
      .find((b) => !b.closest("#gr-cockpit, #gr-panel, #gr-modal") && re.test(text(b)));
    if (btn) { btn.click(); return true; }
    return false;
  }

  function actionButton(a) {
    const cls = `gr-btn${a.primary ? " gr-pri" : ""}`;
    if (a.click) return h("button", { type: "button", class: cls, onclick: () => { if (!clickOriginal(a.click) && a.href) location.href = a.href; } }, a.label);
    return h("a", { class: cls, href: a.href }, a.label);
  }

  // Button that toggles an attribute on <html> and swaps its own text.
  function toggle(attr, offLabel, onLabel, cls) {
    return h("button", { type: "button", class: cls, onclick: (e) => {
      const on = !root.hasAttribute(attr);
      root.toggleAttribute(attr, on);
      e.currentTarget.textContent = on ? onLabel : offLabel;
    } }, root.hasAttribute(attr) ? onLabel : offLabel);
  }

  const ICON = { ok: "✓", warn: "!", bad: "×", todo: "" };

  function checkRow(r) {
    return h(r.href ? "a" : "div", { class: "gr-check", "data-st": r.st, href: r.href },
      h("span", { class: "gr-dot" }), h("span", { class: "gr-cn" }, r.name), h("span", { class: "gr-cs" }, r.status),
      r.required ? h("span", { class: "gr-req" }, "Required") : null);
  }

  function checksBlock(rows) {
    if (!rows?.length) return null;
    const bad = rows.filter((r) => r.st !== "ok"), ok = rows.filter((r) => r.st === "ok");
    return h("div", { class: "gr-checks" }, bad.map(checkRow),
      ok.length ? h("details", { class: "gr-ok-checks" }, h("summary", {}, `${ok.length} passed ${plural(ok.length, "check", "checks")}`), ok.map(checkRow)) : null);
  }

  function render(m) {
    const n = m.items.filter((i) => i.st !== "ok").length;
    const merged = /^(merged|mesclado)$/.test(m.prState), closed = /^(closed|fechado)$/.test(m.prState);
    const open = !merged && !closed;
    const verdict = merged ? "Merged" : closed ? "Closed without merging" : n ? `${n} ${plural(n, "thing", "things")} left before merging`
      : m.threads.open.length ? `Ready to merge · ${m.threads.open.length} open ${plural(m.threads.open.length, "conversation", "conversations")}` : "Ready to merge ✓";

    // U1 (hierarchy through contrast): a single primary button, for the first missing item.
    // Most severe first (failed > attention > pending): that one gets the emphasis.
    const rank = { bad: 0, warn: 1, todo: 2 };
    const todo = m.items.filter((i) => i.st !== "ok").sort((a, b) => rank[a.st] - rank[b.st]), done = m.items.filter((i) => i.st === "ok");
    const firstAct = todo.find((i) => i.act?.length)?.act[0];
    const acts = (it) => (it.act || []).map((a) => actionButton({ ...a, primary: a === firstAct }));
    // The merge bar does not repeat what is already in an item (e.g. "Resolve conflicts").
    const itemLabels = todo.flatMap((i) => (i.act || []).map((a) => a.label.toLowerCase()));
    const dup = (t) => itemLabels.some((l) => l === t.toLowerCase() || (/approve/.test(l) && /approve/i.test(t)));
    const mergeActs = m.mergeActions.filter((t) => !dup(t));

    // U2 (cognitive load): what is already done becomes a subtle line at the end.
    const list = open && m.items.length ? h("div", { class: "gr-todo" },
      todo.map((it) => h("div", { class: "gr-item", "data-st": it.st },
        h("span", { class: "gr-ic" }, ICON[it.st]),
        h("div", { class: "gr-txt" }, h("b", {}, it.title), it.sub ? h("div", { class: "gr-sub" }, it.sub) : null),
        h("div", { class: "gr-acts" }, acts(it)),
        checksBlock(it.checks))),
      done.length ? h("div", { class: "gr-donerow" }, done.map((it) => h("span", {}, h("i", {}, "✓"), it.title))) : null,
      mergeActs.length ? h("div", { class: "gr-merge" },
        h("span", { class: "gr-hint" }, n ? "Merge" : "All set to merge"),
        mergeActs.map((t, i) => h("button", { type: "button", class: `gr-btn${i === mergeActs.length - 1 && !n ? " gr-pri" : ""}`,
          onclick: () => clickOriginal(`^${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }, t))) : null) : null;

    // Rare actions (draft, close, archive) go in a menu; only the shortcut to the original Overview stays visible.
    const more = open ? h("details", { class: "gr-more" }, h("summary", {}, "More actions"),
      h("div", { class: "gr-menu" },
        h("button", { type: "button", onclick: () => clickOriginal(/^convert to draft$/i) }, "Convert to draft"),
        h("button", { type: "button", class: "gr-d", onclick: () => clickOriginal(/^archive pull request$/i) }, "Archive"),
        h("button", { type: "button", class: "gr-d", onclick: () => clickOriginal(/^close pull request$/i) }, "Close pull request"))) : null;
    const foot = h("div", { class: "gr-foot" }, more,
      toggle("data-gr-cockpit-off", "Show original Overview", "Hide original Overview", "gr-orig"));

    if (!open) { el.replaceChildren(); return; } // merged/closed: nothing to do, the GitHub card already says so
    el.replaceChildren(h("div", { class: "gr-verdict" }, h("h2", {}, verdict)), ...[list, foot].filter(Boolean));
  }

  // ---------- right panel + modal ----------

  function card(kind, c) {
    // Reply from someone else = something for you to read: highlight. Your own reply: just the count.
    const theirs = c.replies && c.lastWho && c.lastWho !== "you" && c.lastWho !== c.who;
    const reply = c.replies ? h("span", { class: `gr-rep${theirs ? " gr-rep-new" : ""}` },
      theirs ? `↩ ${c.lastWho} replied` : `${c.replies} ${plural(c.replies, "reply", "replies")}`) : null;
    return h("button", { type: "button", class: `gr-card${c.resolved ? " gr-done" : ""}${theirs ? " gr-hot" : ""}`, onclick: () => openModal(kind, c.i) },
      c.loc ? h("span", { class: "gr-chead" }, h("span", { class: "gr-loc" }, c.loc), c.outdated ? h("span", { class: "gr-tag" }, "Outdated") : null) : null,
      h("span", { class: "gr-ct" }, c.title || "(no text)"),
      h("span", { class: "gr-meta" },
        h("span", { class: "gr-who" }, c.avatar ? h("img", { src: c.avatar, alt: "" }) : null, `${c.who || ""}${c.who && c.when ? " · " : ""}${c.when || ""}`),
        reply));
  }

  // Panel tabs: Unresolved · Resolved · Comments · Details (one at a time).
  // Details shows GitHub's original sidebar (reviewers, labels…),
  // moved into the panel while the tab is open, so editing
  // keeps working. If it cannot be moved (new Overview, React),
  // the original sidebar appears right below the tabs (data-gr-show-sidebar),
  // so you can go back via the tabs.
  let panelTab = "comments";
  let lastModel = null;
  let details = null; // { node, mark }

  function sidebarSource() {
    const sec = document.querySelector("[data-gr-sb]");
    return document.getElementById("partial-discussion-sidebar") || sec?.closest("rails-partial") || null;
  }
  function unmountDetails() {
    if (!details) return;
    details.mark.replaceWith(details.node);
    details = null;
  }
  function mountDetails(host) {
    const node = details?.node || sidebarSource();
    if (!node) return false;
    if (!details) {
      const mark = document.createComment("gr-details");
      node.replaceWith(mark);
      details = { node, mark };
    }
    host.append(node);
    return true;
  }

  // Classic Conversation tab: GitHub's own new-comment box (Rails: toolbar, Preview,
  // attachments, @mentions) moves into the Comments tab, with a marker in its place,
  // instead of a second, simpler box. The new Overview's box is React: never moved.
  let composerBox = null; // { node, mark }
  // Where the box lives on the page: the timeline's last partial (Rails).
  const composerHome = () => document.querySelector("rails-partial[data-partial-name$='TimelineActions']") || document.querySelector(".js-discussion");
  // GitHub's box: the Rails new-comment form (never the React one, never a copy in the modal body).
  function findComposer() {
    const forms = [...document.querySelectorAll("form.js-new-comment-form")]
      .filter((f) => !f.closest("[data-testid='timeline-item'], #gr-modal .gr-mbody"));
    // A box GitHub rendered again on the page wins over an old one left in our panel.
    const form = forms.find((f) => !f.closest("#gr-panel, #gr-modal")) || forms[0];
    return form ? form.closest("#issue-comment-box") || form.closest(".timeline-new-comment") || form : null;
  }
  function unmountComposer() {
    if (!composerBox) return;
    const { node, mark } = composerBox;
    if (mark.isConnected) mark.replaceWith(node);
    // GitHub re-rendered the timeline (live update) and our marker went with it:
    // the box goes back to the end of the timeline instead of being lost with the panel.
    else if (node.closest("#gr-panel, #gr-modal") && !findComposerOnPage(node)) composerHome()?.append(node);
    composerBox = null;
  }
  const findComposerOnPage = (except) => [...document.querySelectorAll("form.js-new-comment-form")]
    .some((f) => !except.contains(f) && !f.closest("#gr-panel, #gr-modal, [data-testid='timeline-item']"));
  function mountComposer(host) {
    let node = composerBox?.node;
    // Our box was replaced by a fresh one on the page (live update): use the fresh one.
    if (node && (!node.isConnected || !composerBox.mark.isConnected) && findComposerOnPage(node)) {
      composerBox = null;
      node = null;
    }
    if (!node) {
      node = findComposer();
      if (!node) return false;
      const mark = document.createComment("gr-composer");
      if (node.closest("#gr-panel, #gr-modal")) composerHome()?.append(mark); // left in the panel earlier
      else node.replaceWith(mark);
      composerBox = { node, mark };
    }
    host.append(node);
    return true;
  }

  function openTab(key) {
    panelTab = key;
    root.removeAttribute("data-gr-show-sidebar");
    if (lastModel) renderPanel(lastModel);
  }

  function renderPanel(m) {
    lastModel = m;
    const { open, resolved } = m.threads;
    // Always opens on Unresolved and never switches tabs on its own: conversations arrive
    // gradually (React), and picking the tab from the data made the panel jump tabs.
    const stacked = root.hasAttribute("data-gr-stacked");
    const tabs = [["open", "Open", open.length], ["resolved", "Resolved", resolved.length], ["comments", "Comments", m.comments.length], ["details", "Details", null]];
    const bar = h("div", { class: "gr-tabs", role: "tablist", "aria-label": "Conversations and details" },
      tabs.map(([key, label, n]) => h("button", { type: "button", role: "tab", class: `gr-tab${key === "open" && n ? " gr-attn" : ""}`, "aria-selected": String(panelTab === key),
        onclick: () => openTab(key) }, label, n == null ? null : h("span", { class: "gr-n" }, String(n)))));

    if (panelTab === "details") {
      const host = h("div", { class: "gr-details", role: "tabpanel" });
      panel.replaceChildren(bar, host);
      // Stacked: the GitHub sidebar appears right below the tabs (CSS hides what is in between).
      if (stacked) unmountDetails();
      if (stacked || !mountDetails(host)) root.setAttribute("data-gr-show-sidebar", "");
      else root.removeAttribute("data-gr-show-sidebar");
      unmountComposer();
      return;
    }
    unmountDetails();
    const list = panelTab === "comments" ? m.comments.map((c) => card("comments", c))
      : (panelTab === "open" ? open : resolved).map((c) => card("threads", c));
    // Empty state: icon, title and one sentence; subtle shortcuts only when there is somewhere to go.
    const E = {
      open: ["✓", "Nothing open", resolved.length ? `All ${resolved.length} code ${plural(resolved.length, "conversation is", "conversations are")} resolved.` : "No one has commented on the code yet."],
      resolved: ["○", "Nothing resolved", "Resolved code conversations will show up here."],
      comments: ["💬", "No comments", "General comments on this pull request will show up here."],
    }[panelTab];
    const link = (label, key) => h("button", { type: "button", class: "gr-elink", onclick: () => openTab(key) }, label);
    const links = panelTab === "open" ? [resolved.length && link(`See resolved (${resolved.length})`, "resolved"), m.comments.length && link(`See comments (${m.comments.length})`, "comments")].filter(Boolean) : [];
    const emptyBox = h("div", { class: "gr-empty", "data-kind": panelTab },
      h("span", { class: "gr-eicon" }, E[0]), h("b", {}, E[1]), h("p", {}, E[2]),
      links.length ? h("div", { class: "gr-empty-acts" }, links) : null);
    const composerHost = panelTab === "comments" ? h("div", { class: "gr-gh-composer" }) : null;
    const original = composerHost && mountComposer(composerHost);
    if (!composerHost) unmountComposer();
    panel.replaceChildren(bar, h("div", { class: "gr-list", role: "tabpanel" },
      original ? composerHost : panelTab === "comments" && pageComposer() ? newComment() : null,
      list.length ? list : emptyBox));
  }

  // The modal shows GitHub's original conversation (moved inside while
  // open, with a marker in its place), so Reply, Resolve, reactions
  // and suggestions keep working there. We only move what the server
  // rendered (Rails: turbo-frame / js-* elements); the rest becomes a copy.
  let moved = null; // { orig, mark }
  let modalQuote = null; // { field, text }: GitHub's comment box in the modal footer

  function closeModal() {
    const hadComposer = !!modalQuote;
    if (modalQuote) {
      // Untouched quote: GitHub's box goes back to the panel empty.
      if (modalQuote.field.value === modalQuote.text) fill(modalQuote.field, "");
      modalQuote = null;
    }
    if (moved) {
      moved.unhidden.forEach((n) => (n.hidden = true));
      moved.mark.replaceWith(moved.orig);
      moved = null;
    }
    document.getElementById("gr-modal")?.remove();
    // GitHub's comment box was in the modal footer: back to the Comments tab (or its place).
    if (hadComposer && lastModel) { panelSig = null; renderPanel(lastModel); }
    document.removeEventListener("keydown", onKey, true);
  }
  function onKey(e) {
    if (e.key === "Escape" && !e.target.closest?.("textarea")) { e.stopPropagation(); closeModal(); }
  }

  // Never move what React rendered (new Overview): it loses the reference and breaks.
  const movable = (n) => !n.closest("[data-testid='timeline-item']") &&
    (n.matches(".js-resolvable-timeline-thread-container, .js-timeline-item, .timeline-comment-group") || !!n.closest("turbo-frame"));

  // The conversation's own reply/resolve controls: in the modal our field handles
  // that, so we remove GitHub's (otherwise there are two fields and two "Resolve").
  const REPLY_CTRL = /^(write a reply|reply…|reply\.\.\.|add a reply|resolve|resolve conversation|unresolve|unresolve conversation)$/i;
  function stripReplyControls(scope) {
    const hits = new Set();
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode: (n) => REPLY_CTRL.test(n.nodeValue.trim()) ? 1 : 3 });
    while (walker.nextNode()) { const e = walker.currentNode.parentElement; hits.add(e.closest("button, [role='button'], [tabindex], label") || e); }
    scope.querySelectorAll("[placeholder], [aria-label]").forEach((e) => { if (REPLY_CTRL.test(e.getAttribute("placeholder") || "") || REPLY_CTRL.test((e.getAttribute("aria-label") || "").replace(/ in .*$/, ""))) hits.add(e); });
    for (let e of hits) {
      let parent = e.parentElement;
      e.remove();
      // Walk up removing containers left empty (the "Write a reply | Resolve" row).
      while (parent && parent !== scope && !parent.textContent.trim() && !parent.querySelector("img")) { const up = parent.parentElement; parent.remove(); parent = up; }
    }
  }

  function readOnlyCopy(orig) {
    const copy = orig.cloneNode(true);
    copy.querySelectorAll("form, textarea, input, .js-comment-edit-button, .timeline-comment-actions, [hidden]").forEach((n) => n.remove());
    stripReplyControls(copy);
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    return copy;
  }

  const clickIn = (scope, re) => {
    const b = [...scope.querySelectorAll("button, summary, [role='button']")].find((x) => re.test(text(x)) || re.test(x.getAttribute("aria-label") || ""));
    b?.click();
    return !!b;
  };

  // Writes into a GitHub <textarea> in a way React also notices.
  function fill(field, value) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Sends via the original reply box: the conversation's, or the page's new-comment
  // box (quoting the comment) when it is a general comment.
  function submitReply(kind, orig, body) {
    let field;
    if (kind === "threads") {
      field = orig.querySelector("textarea");
      if (!field) { clickIn(orig, /^reply/i); field = orig.querySelector("textarea"); }
    } else {
      field = pageComposer();
      const quote = text(orig.querySelector(".comment-body, .js-comment-body, .markdown-body")).slice(0, 280);
      if (field && quote) body = `> ${quote}\n\n${body}`;
    }
    const form = field?.closest("form");
    if (!field || !form) return false;
    fill(field, body);
    form.requestSubmit();
    return true;
  }

  // The page's (hidden) new-comment box: used by the panel and by replies.
  const pageComposer = () => document.querySelector("#new_comment_field, form.js-new-comment-form textarea, main textarea[name='comment[body]'], main textarea[placeholder*='comment' i]");

  // ---------- rich editor (new Overview) ----------
  // GitHub's box there is React: it can't be moved into the panel. Our field gets the
  // same tools, and the hidden React box does the GitHub-side work: Preview (it renders
  // the markdown) and attachments (it uploads the file and writes the link).

  const MD_TOOLS = [
    ["heading", "Heading", "H"], ["bold", "Bold", "B"], ["italic", "Italic", "I"], null,
    ["quote", "Quote", "❝"], ["code", "Code", "<>"], ["link", "Link", "🔗"], null,
    ["ol", "Numbered list", "1."], ["ul", "Unordered list", "•"], ["task", "Task list", "☐"], null,
    ["mention", "Mention", "@"],
  ];
  // GitHub's own icon for a tool, copied from the toolbar of the page's (React) box.
  function toolIcon(label) {
    const engine = pageComposer();
    const box = engine && engineBox(engine);
    const name = (b) => [b.getAttribute("aria-label"), ...["aria-labelledby", "aria-describedby"].flatMap((k) => (b.getAttribute(k) || "").split(" ").map((id) => id && document.getElementById(id)?.textContent))]
      .filter(Boolean).join(" ").trim().toLowerCase() || b.textContent.trim().toLowerCase();
    const btn = [...(box?.querySelectorAll("button") || [])].find((b) => name(b).startsWith(label.toLowerCase()) && b.querySelector("svg"));
    return btn ? btn.querySelector("svg").cloneNode(true) : null;
  }
  // Same edits as GitHub's markdown toolbar: wrap the selection, or prefix each selected line.
  function applyMd(field, kind) {
    const v = field.value;
    let s = field.selectionStart, e = field.selectionEnd;
    const sel = v.slice(s, e);
    const wrap = (l, r, ph) => { const t = sel || ph; field.setRangeText(`${l}${t}${r}`, s, e, "end"); field.setSelectionRange(s + l.length, s + l.length + t.length); };
    const lines = (fn) => {
      s = s > 0 ? v.lastIndexOf("\n", s - 1) + 1 : 0;
      const block = v.slice(s, e);
      const out = block.split("\n").map((l, i) => fn(i) + l).join("\n");
      field.setRangeText(out, s, e, "end");
    };
    switch (kind) {
      case "heading": lines(() => "### "); break;
      case "bold": wrap("**", "**", "text"); break;
      case "italic": wrap("_", "_", "text"); break;
      case "quote": lines(() => "> "); break;
      case "code": sel.includes("\n") ? wrap("```\n", "\n```", "") : wrap("`", "`", "code"); break;
      case "link": { const t = sel || "text"; field.setRangeText(`[${t}](url)`, s, e, "end"); const u = s + t.length + 3; field.setSelectionRange(u, u + 3); break; }
      case "ol": lines((i) => `${i + 1}. `); break;
      case "ul": lines(() => "- "); break;
      case "task": lines(() => "- [ ] "); break;
      case "mention": field.setRangeText("@", s, e, "end"); break;
    }
    field.focus();
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // The React editor around the page's (hidden) comment box, and its Write/Preview tabs.
  const engineBox = (t) => { let e = t; while (e && e !== document.body && !e.querySelector("[role='tablist']")) e = e.parentElement; return e && e !== document.body ? e : null; };
  const engineTab = (box, re) => [...(box?.querySelectorAll("[role='tab'], button") || [])].find((b) => re.test(text(b)));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(fn, ms = 6000) { for (let t = 0; t < ms; t += 120) { const v = fn(); if (v) return v; await sleep(120); } return null; }

  // Preview through GitHub: the text goes into the hidden box, its Preview tab renders
  // it, we show a copy, then the box gets its own text back.
  let engineBusy = false;
  async function renderPreview(md, pane) {
    const engine = pageComposer();
    const box = engine && engineBox(engine);
    const tab = engineTab(box, /^preview$/i);
    if (!engine || !tab || engineBusy) { pane.replaceChildren(h("p", { class: "gr-ed-note" }, "Preview isn't available here.")); return; }
    engineBusy = true;
    const saved = engine.value;
    try {
      if (!md.trim()) { pane.replaceChildren(h("p", { class: "gr-ed-note" }, "Nothing to preview")); return; }
      pane.replaceChildren(h("p", { class: "gr-ed-note" }, "Loading preview…"));
      fill(engine, md);
      tab.click();
      const body = await waitFor(() => { const b = box.querySelector(".markdown-body"); return b && (b.textContent.trim() || b.querySelector("img, video")) ? b : null; });
      if (!pane.isConnected) return;
      if (!body) { pane.replaceChildren(h("p", { class: "gr-ed-note" }, "Couldn't load the preview.")); return; }
      const copy = body.cloneNode(true);
      copy.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
      pane.replaceChildren(copy);
    } finally {
      engineTab(box, /^write$/i)?.click();
      const back = await waitFor(() => pageComposer(), 2000);
      if (back) fill(back, saved);
      engineBusy = false;
    }
  }

  // Attachments through GitHub: the files are dropped on the hidden box, which uploads
  // them and writes the markdown link; that link comes into our field.
  async function uploadFiles(files, field, status) {
    const engine = pageComposer();
    if (!engine || !files.length || engineBusy) { status.textContent = "Couldn't attach here."; return; }
    engineBusy = true;
    const saved = engine.value;
    try {
      fill(engine, "");
      status.textContent = `Uploading ${files.length === 1 ? files[0].name : `${files.length} files`}…`;
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      engine.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
      if (!(await waitFor(() => pageComposer()?.value, 1500))) {
        const dt2 = new DataTransfer();
        files.forEach((f) => dt2.items.add(f));
        pageComposer()?.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt2 }));
      }
      const link = await waitFor(() => { const v = pageComposer()?.value || ""; return v.trim() && !/uploading/i.test(v) ? v.trim() : null; }, 60000);
      if (!link) { status.textContent = "The upload didn't finish."; return; }
      const s = field.selectionStart, pre = field.value.slice(0, s);
      field.setRangeText(`${pre && !pre.endsWith("\n") ? "\n" : ""}${link}\n`, s, field.selectionEnd, "end");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      status.textContent = "";
    } finally {
      const back = pageComposer();
      if (back) fill(back, saved);
      engineBusy = false;
    }
  }

  // Our field with GitHub's comment-box structure: Write | Preview, toolbar, footer.
  function richEditor(field, status, actions = []) {
    const preview = h("div", { class: "gr-ed-preview markdown-body", hidden: true });
    const write = h("button", { type: "button", role: "tab", class: "gr-ed-tab", "aria-selected": "true" }, "Write");
    const prev = h("button", { type: "button", role: "tab", class: "gr-ed-tab", "aria-selected": "false" }, "Preview");
    const tools = h("div", { class: "gr-ed-tools", role: "toolbar" });
    const show = (p) => {
      write.setAttribute("aria-selected", String(!p)); prev.setAttribute("aria-selected", String(p));
      field.hidden = p; preview.hidden = !p; tools.hidden = p;
      if (p) renderPreview(field.value, preview); else field.focus();
    };
    write.addEventListener("click", () => show(false));
    prev.addEventListener("click", () => show(true));
    for (const t of MD_TOOLS) {
      if (!t) { tools.append(h("span", { class: "gr-ed-sep" })); continue; }
      const [kind, label, glyph] = t;
      const b = h("button", { type: "button", class: "gr-ed-tool", title: label, "aria-label": label, onmousedown: (e) => e.preventDefault(), onclick: () => applyMd(field, kind) });
      const icon = toolIcon(label);
      icon ? b.append(icon) : (b.textContent = glyph);
      tools.append(b);
    }
    const file = h("input", { type: "file", multiple: true, hidden: true });
    file.addEventListener("change", () => { uploadFiles([...file.files], field, status); file.value = ""; });
    field.addEventListener("paste", (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); uploadFiles(fs, field, status); } });
    field.addEventListener("dragover", (e) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); });
    field.addEventListener("drop", (e) => { const fs = [...(e.dataTransfer?.files || [])]; if (fs.length) { e.preventDefault(); uploadFiles(fs, field, status); } });
    return h("div", { class: "gr-ed" },
      h("div", { class: "gr-ed-head" }, h("div", { class: "gr-ed-tabs", role: "tablist" }, write, prev), tools),
      h("div", { class: "gr-ed-body" }, field, preview),
      // Footer: attach on the left, the send button(s) on the right, inside the box.
      h("div", { class: "gr-ed-foot" },
        h("button", { type: "button", class: "gr-ed-attach", title: "Paste, drop, or click to add files", onclick: () => file.click() },
          toolIcon("Paste, drop") || "📎", "Add files"),
        file,
        h("div", { class: "gr-ed-acts" }, actions)));
  }

  // New comment at the top of the Comments tab. Created only once, so the draft
  // survives when the panel is re-rendered.
  let newBox = null;
  function newComment() {
    if (newBox) return newBox;
    const field = h("textarea", { class: "gr-reply", rows: "4", placeholder: "Add your comment here…" });
    const status = h("span", { class: "gr-rstatus" });
    const send = () => {
      // The hidden box is busy with a preview or upload: sending now would mix the two.
      if (engineBusy) { status.textContent = "Wait for the preview or upload to finish."; return; }
      const body = field.value.trim();
      if (!body) return field.focus();
      const target = pageComposer(), form = target?.closest("form");
      if (!form) { status.textContent = "Couldn't find GitHub's comment box."; return; }
      fill(target, body);
      form.requestSubmit();
      field.value = "";
      status.textContent = "Comment sent.";
    };
    field.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } });
    newBox = h("div", { class: "gr-new" },
      richEditor(field, status, [h("button", { type: "button", class: "gr-btn gr-pri", title: "Comment (⌘↵)", onclick: send }, "Comment")]),
      status);
    return newBox;
  }

  function composer(kind, orig) {
    const field = h("textarea", { class: "gr-reply", rows: "3", placeholder: kind === "threads" ? "Reply to this conversation…" : "Reply (the comment will be quoted)…" });
    const status = h("span", { class: "gr-rstatus" });
    const canResolve = kind === "threads" && !threadResolved(orig);
    // With no text the button only resolves; with text, it replies and resolves.
    const resolveBtn = canResolve ? h("button", { type: "button", class: "gr-btn", onclick: () => send(true) }, "Resolve") : null;
    const syncLabel = () => { if (resolveBtn) resolveBtn.textContent = field.value.trim() ? "Reply and resolve" : "Resolve"; };
    const send = (resolve) => {
      const body = field.value.trim();
      if (!body && !resolve) { field.focus(); return; }
      // Only a comment reply goes through the hidden page box; a code thread uses its own.
      if (engineBusy && kind !== "threads") { status.textContent = "Wait for the preview or upload to finish."; return; }
      const sent = body ? submitReply(kind, orig, body) : true;
      if (!sent) { status.textContent = "Couldn't find GitHub's reply box here. Use the link at the top to open it on GitHub."; return; }
      const resolved = resolve ? clickIn(orig, /^resolve( conversation)?\b/i) : false;
      field.value = "";
      syncLabel();
      if (resolve && !resolved) { status.textContent = body ? "Replied. Couldn't find the resolve button." : "Couldn't find the resolve button. Use the link at the top to open it on GitHub."; return; }
      status.textContent = resolve ? (body ? "Replied and resolved." : "Resolved.") : "Reply sent.";
      if (resolve) setTimeout(closeModal, 700);
    };
    field.addEventListener("input", syncLabel);
    field.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(false); } });
    return h("div", { class: "gr-composer" },
      richEditor(field, status, [resolveBtn, h("button", { type: "button", class: "gr-btn gr-pri", title: "Reply (⌘↵)", onclick: () => send(false) }, "Reply")]),
      status);
  }


  // Text the reader sees: without what is collapsed (<details> closed), diagrams and
  // hidden bits. innerText of an off-screen copy keeps the line breaks.
  function visibleText(node) {
    if (!node) return "";
    const copy = node.cloneNode(true);
    copy.querySelectorAll("details:not([open]) > :not(summary), [hidden], template, svg, .sr-only, .js-render-enrichment-loader, [data-type='mermaid'] ~ *").forEach((n) => n.remove());
    const box = Object.assign(document.createElement("div"), { style: "position:fixed;left:-10000px;top:0;width:600px" });
    box.append(copy);
    document.body.append(box);
    const t = copy.innerText;
    box.remove();
    return t;
  }

  function openModal(kind, i) {
    const orig = refs[kind][i];
    if (!orig?.isConnected) return;
    closeModal();

    let content;
    if (movable(orig)) {
      const mark = document.createComment("gr-modal");
      orig.replaceWith(mark);
      const unhidden = [...orig.querySelectorAll("[data-target='review-thread-collapsible.body'][hidden]")];
      unhidden.forEach((n) => (n.hidden = false));
      moved = { orig, mark, unhidden };
      content = orig;
    } else {
      content = readOnlyCopy(orig);
    }

    // Classic page (conversation moved, not copied): GitHub's own reply boxes, with
    // Write/Preview, toolbar and attachments. Code conversation: the thread's own
    // reply form and "Resolve conversation" stay visible. Comment: the page's comment
    // box comes into the footer, quoting the comment.
    const native = !!moved;
    let footer = null;
    if (native && kind === "comments") {
      const host = h("div", { class: "gr-composer gr-gh-composer" });
      if (mountComposer(host)) {
        footer = host;
        const field = host.querySelector("textarea");
        // What is visible (innerText skips collapsed <details>), quoted line by line, like GitHub's "Quote reply".
        const body = orig.querySelector(".comment-body, .js-comment-body, .markdown-body");
        const lines = visibleText(body).split("\n").map((l) => l.trim()).filter(Boolean);
        let quote = lines.join("\n");
        if (quote.length > 600) quote = `${quote.slice(0, 600).replace(/\s+\S*$/, "")}…`;
        if (field && quote && !field.value.trim()) { const q = `${quote.split("\n").map((l) => `> ${l}`).join("\n")}\n\n`; fill(field, q); modalQuote = { field, text: q }; }
        else if (field) modalQuote = { field, text: null };
      }
    }
    if (!footer && !(native && kind === "threads")) footer = composer(kind, orig);

    // Clicking a link inside the conversation (e.g. "go to code") leads to another page: close the modal.
    const modal = h("div", { id: "gr-modal", onclick: (e) => {
      if (e.target.id === "gr-modal") return closeModal();
      const a = e.target.closest("a[href]");
      if (a && !a.getAttribute("href").startsWith("#") && !e.metaKey && !e.ctrlKey && !e.shiftKey) setTimeout(closeModal, 0);
    } },
      h("div", { class: "gr-mbox", role: "dialog", "aria-modal": "true" },
        h("div", { class: "gr-mhead" },
          h("b", {}, kind === "threads" ? "Code conversation" : "Comment"),
          h("button", { type: "button", class: "gr-x", "aria-label": "Close", onclick: closeModal }, "×")),
        h("div", { class: "gr-mbody" }, content),
        footer));
    if (native) modal.setAttribute("data-native", "");
    document.body.appendChild(modal);
    // Collapsed conversation in the new Overview: ask GitHub to expand it and refresh the copy.
    if (kind === "threads" && isNewThread(orig) && !orig.querySelector(".markdown-body")) {
      orig.querySelector("[data-dd-action-name='pull_requests.thread.expand'], [aria-label^='Open review comment']")?.click();
      let tries = 0;
      const poll = setInterval(() => {
        const body = modal.isConnected && modal.querySelector(".gr-mbody");
        if (!body || ++tries > 20) return clearInterval(poll);
        if (orig.querySelector(".markdown-body")) { body.replaceChildren(readOnlyCopy(orig)); clearInterval(poll); }
      }, 150);
    }
    document.addEventListener("keydown", onKey, true);
    const focus = modal.querySelector(".gr-reply, .gr-gh-composer textarea");
    focus?.focus();
    if (focus?.matches(".gr-gh-composer textarea")) focus.setSelectionRange(focus.value.length, focus.value.length);
  }

  // ---------- mounting ----------

  // Cockpit before the merge box (or the description); panel inside the columns
  // container, in place of the sidebar. Re-placed if React re-renders.
  let placedOnce = false;
  function place() {
    // The cockpit goes on top: before the merge box (new Overview, where it is above the
    // description) or before the description (classic tab, merge box at the end of the timeline).
    const box = document.querySelector("[data-gr-mergebox]"), desc = document.querySelector("[data-gr-desc]");
    const anchor = box && desc && (desc.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING) ? desc : box || desc;
    if (!anchor?.parentElement) return false;
    if (!el.isConnected || el.nextElementSibling !== anchor) anchor.parentElement.insertBefore(el, anchor);
    const cols = document.querySelector("[data-gr-cols]");
    // Narrow screen (Primer stacks the columns): the panel comes right below the
    // cockpit, instead of ending up at the bottom of the page or off-screen.
    // Without an identified side column (e.g. GitHub sidebar not rendered), the panel stays below the cockpit.
    // Page still loading (GitHub columns not mounted) on a wide screen: the
    // panel waits, instead of showing in the left column and then jumping.
    // Only show the panel once the main column has content (description
    // loaded and the cockpit inside the same columns); otherwise it appears alone
    // on the left and jumps to the right when the rest arrives.
    // Ready = the main column already has real content (height), not just the skeleton.
    const main = cols && [...cols.children].find((c) => c !== panel && /ContentWrapper/.test(c.className));
    const ready = !!(main && main.getBoundingClientRect().height > 240 && document.querySelector("[data-gr-desc], section:has(#overview-comments)"));
    // Only on first placement: after that, resizing (or the Details tab on
    // mobile, which leaves the column with display:contents and height 0) must not
    // hide the panel.
    if (ready) placedOnce = true;
    if (!ready && !placedOnce && innerWidth >= 900) { panel.remove(); setTimeout(() => el?.isConnected && place(), 300); return true; }
    // Do not check the columns' flex-direction: with data-gr-stacked our CSS forces
    // "column", and the panel would never go back to the side when widening the window.
    const narrow = !cols || innerWidth < 900;
    // Stacked (mobile/narrow screen): the panel comes after the description, and
    // GitHub's original sidebar appears at the end of the page (no Details tab).
    if (narrow) {
      // Order: cockpit → description → conversations (panel) → commits → Details (the CSS
      // sends commits after the panel, without moving the React node).
      const desc = document.querySelector("[data-gr-desc]");
      const after = desc && desc.parentElement === el.parentElement ? desc : el;
      if (after.nextElementSibling !== panel) after.after(panel);
    } else if (cols && panel.parentElement !== cols) cols.appendChild(panel);
    const was = root.hasAttribute("data-gr-stacked");
    root.toggleAttribute("data-gr-stacked", narrow);
    panel.toggleAttribute("data-stacked", narrow);
    if (was !== narrow && lastModel) renderPanel(lastModel);
    return true;
  }
  // "More actions" menu (<details>): closes on outside click, on choosing an option, or with Esc.
  document.addEventListener("click", (e) => {
    for (const d of document.querySelectorAll("#gr-cockpit .gr-more[open]")) {
      if (!d.contains(e.target) || e.target.closest(".gr-menu button")) d.open = false;
    }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.querySelectorAll("#gr-cockpit .gr-more[open]").forEach((d) => (d.open = false));
  });
  // GitHub side panel opened as a drawer (CSS): clicking outside or Esc closes it,
  // using GitHub's own close button.
  const SIDE = '[class*="prc-PageLayout-SidebarWrapper-"][data-position="end"]:not([class*="HiddenSidePanel"]):not([data-is-hidden="true"])';
  // GitHub's close button usually has its name in a tooltip (aria-labelledby), not in aria-label.
  const labelOf = (b) => [b.getAttribute("aria-label"), ...(b.getAttribute("aria-labelledby") || "").split(" ").map((id) => id && document.getElementById(id)?.textContent),
    b.nextElementSibling?.matches?.("[role='tooltip'], [popover]") ? b.nextElementSibling.textContent : ""].filter(Boolean).join(" ");
  const closeSide = (panel) => {
    if (!panel) return;
    const btn = [...panel.querySelectorAll("button")].find((b) => /^close\b/i.test(labelOf(b).trim()))
      || [...document.querySelectorAll("button[aria-expanded='true']")].find((b) => /close (side )?panel|comments|activity/i.test(labelOf(b)));
    btn?.click();
  };
  document.addEventListener("mousedown", (e) => {
    const panel = document.querySelector(SIDE);
    if (!panel || panel.contains(e.target) || e.target.closest?.("[role='dialog'], [role='menu'], [role='listbox'], [popover], #__primerPortalRoot__, #gr-modal")) return;
    // The buttons that open the panel (fixed bar) must not close it before reopening.
    // Only the fixed-bar buttons that open/close panels are excluded; any
    // other area of the page (including the PR header) closes the drawer.
    if (e.target.closest?.("[data-docked-panel-toggle], [class*='StickyHeader'] button, [class*='miniHeader'] button")) return;
    closeSide(panel);
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.getElementById("gr-modal")) closeSide(document.querySelector(SIDE)); });
  // GitHub menus opened from the drawer (sort, filters): GitHub computes the
  // position as if the panel were in its original place and the menu goes to the corner
  // of the screen. We reposition the menu right below the button that opened it.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("button");
    if (!btn || !btn.closest(SIDE)) return;
    let tries = 0;
    const fix = () => {
      const menu = [...document.querySelectorAll("[role='menu'], [role='listbox'], [role='dialog']")]
        .find((m) => m.offsetParent !== null && !m.closest(SIDE) && !m.closest("#gr-modal"));
      if (!menu) { if (++tries < 15) requestAnimationFrame(fix); return; }
      let box = menu;
      while (box.parentElement && box.parentElement !== document.body && !box.style.top && !box.style.left && !/absolute|fixed/.test(getComputedStyle(box).position)) box = box.parentElement;
      const a = btn.getBoundingClientRect(), w = box.getBoundingClientRect().width;
      Object.assign(box.style, { position: "fixed", top: `${Math.round(a.bottom + 4)}px`, left: `${Math.round(Math.max(8, Math.min(a.right - w, innerWidth - w - 8)))}px`, zIndex: 300 });
    };
    requestAnimationFrame(fix);
  }, true);
  let resizeTimer = 0;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (el?.isConnected) place(); }, 150);
  });

  const UI_ATTRS = ["data-gr-cockpit-ready", "data-gr-show-sidebar", "data-gr-cockpit-off", "data-gr-stacked"];
  let lastPath = null;

  function teardown() {
    newBox = null;
    placedOnce = false;
    unmountDetails();
    unmountComposer();
    panelTab = "comments";
    el?.remove();
    panel?.remove();
    closeModal();
    renderedSig = panelSig = null;
    for (const a of UI_ATTRS) root.removeAttribute(a);
  }

  function update({ settings, textNodes }) {
    const isPull = /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(location.pathname);
    if (!settings.enabled || !settings.cockpit || !isPull) { teardown(); return; }
    if (lastPath !== location.pathname) { lastPath = location.pathname; teardown(); }

    if (!el) el = h("section", { id: "gr-cockpit", "aria-label": "Pull request summary" });
    if (!panel) panel = h("aside", { id: "gr-panel", "aria-label": "Conversations and comments" });
    if (!place()) return;
    // Original Overview visible: the sidebar must be in its place.
    if (root.hasAttribute("data-gr-cockpit-off") && (details || composerBox)) { unmountDetails(); unmountComposer(); panelTab = "comments"; panelSig = null; }

    hydrateCollapsed();
    const m = readPage(textNodes);
    // With nothing recognized on an open PR, we leave the page alone.
    const usable = m.items.length > 0 || !/^(open|aberto|draft|rascunho)$/.test(m.prState);
    root.toggleAttribute("data-gr-cockpit-ready", usable);
    if (!usable) { unmountDetails(); unmountComposer(); el.replaceChildren(); panel.replaceChildren(); renderedSig = panelSig = null; return; }

    const { threads, comments, ...main } = m;
    const sig = JSON.stringify(main);
    // Summary off: the rare actions (draft, archive, close) live in the header's Actions menu (content.js).
    if (SHOW_SUMMARY && sig !== renderedSig) { renderedSig = sig; render(m); }
    const psig = JSON.stringify({ threads, comments });
    // A conversation moved into the modal is not on the page: keep the panel as it was
    // until the modal closes (otherwise its card and count vanish meanwhile).
    if (psig !== panelSig && !moved) { panelSig = psig; renderPanel(m); }
  }

  return { update };
})();
