/* GitHub Refine — content script
 *
 * Como a página é alterada (três camadas):
 *
 * 1. Configuração → atributos no <html>
 *    `data-gr-theme`, `data-gr-cards`... O CSS só age quando o atributo existe,
 *    então ligar/desligar é instantâneo e não deixa resto.
 *
 * 2. Marcação semântica (este arquivo)
 *    O GitHub novo é React com classes geradas (ex.: `prc-ListView-xyz`), que mudam
 *    a cada deploy. Em vez de mirar nelas, encontramos os elementos por pistas
 *    estáveis (links `/pull/123`, ícones octicon, aria-labels, nomes de autor) e
 *    gravamos NOSSOS atributos: `data-gr-row`, `data-gr-state`, `data-gr-bot`...
 *    O CSS mira só nesses atributos. Quando o GitHub mudar o HTML, só a detecção
 *    aqui precisa de ajuste.
 *
 * 3. CSS (refine.css)
 *    Tokens do Primer (`--bgColor-default`, ...) para o tema inteiro, e regras
 *    sobre os atributos `data-gr-*` para o layout.
 *
 * Regra de ouro com React: não mover nem apagar nós que o React controla.
 * Reordenar = `order` no CSS; esconder = `display: none`. Só acrescentamos um nó
 * nosso (o botão de bots), e o recolocamos se o React o descartar.
 */
(() => {
  const root = document.documentElement;
  let settings = { ...GR_DEFAULTS };

  // ---------- Navegação SPA ----------
  // O GitHub troca de página sem recarregar (Turbo + React). Um MutationObserver
  // com throttle por frame cobre tudo: navegação, filtros, paginação, lazy load.
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
  // ---------- 1. Configuração ----------

  function applySettings(s) {
    // O popup só tem liga/desliga e cor: os recursos usam sempre o padrão
    // (ignora escolhas antigas guardadas de quando havia um interruptor por recurso).
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

  // Primeira pintura: chrome.storage é assíncrono e causaria um "piscar" do
  // visual original. Guardamos uma cópia no localStorage do github.com, que é
  // síncrono, e aplicamos já no document_start.
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

  // ---------- 2. Marcação semântica ----------

  const PR_HREF = /\/[^/]+\/[^/]+\/(pull|issues)\/\d+\/?$/;
  const BOT_AUTHOR = /(dependabot|renovate|github-actions|\[bot\])/i;
  const BOT_TITLE = /^(build|chore|fix)\(deps(-dev)?\)|^bump\s/i;

  function rowStateOf(row) {
    const has = (sel) => row.querySelector(sel) !== null;
    const label = [...row.querySelectorAll("svg[aria-label], [aria-label] > svg")]
      .map((el) => (el.getAttribute("aria-label") || el.parentElement.getAttribute("aria-label") || "").toLowerCase())
      .join(" ");
    if (has(".octicon-git-pull-request-draft, .octicon-issue-draft") || label.includes("draft")
      || [...row.querySelectorAll("span, div")].some((e) => !e.children.length && e.textContent.trim() === "Draft")) return "draft";
    if (has(".octicon-git-merge") || label.includes("merged")) return "merged";
    if (has(".octicon-git-pull-request-closed, .octicon-skip, .octicon-issue-closed") || label.includes("closed")) return "closed";
    return "open";
  }

  function tagListRows() {
    // Só em listas (PRs, issues, busca). Numa issue/PR aberta, os links de
    // "mentioned this" da linha do tempo não são linhas de lista: limpa marcas que
    // tenham ficado de uma lista visitada antes (navegação sem recarregar).
    if (/\/(issues|pull)\/\d+/.test(location.pathname)) {
      for (const el of document.querySelectorAll("[data-gr-row], [data-gr-title], [data-gr-list]")) {
        if (el.closest("#gr-panel, #gr-cockpit, #gr-modal")) continue;
        for (const a of ["data-gr-row", "data-gr-title", "data-gr-list", "data-gr-state", "data-gr-bot", "data-gr-draft"]) el.removeAttribute(a);
      }
      document.querySelectorAll("main .gr-bot-toggle").forEach((t) => t.remove());
      return;
    }
    const lists = new Set();
    for (const link of document.querySelectorAll('a[href*="/pull/"], a[href*="/issues/"]')) {
      const href = link.getAttribute("href") || "";
      if (!PR_HREF.test(href)) continue;
      // Linha = o <li> mais próximo (lista nova em React) ou a linha da lista antiga.
      const row = link.closest('li, [role="listitem"], .js-issue-row');
      if (!row || row.closest("[data-gr-skip], .markdown-body, nav, header")) continue;
      // O primeiro link de PR dentro da linha é o título; ignore links secundários.
      const title = row.querySelector("[data-gr-title]");
      if (title && title !== link) continue;

      link.setAttribute("data-gr-title", "");
      row.setAttribute("data-gr-row", "");
      row.setAttribute("data-gr-state", rowStateOf(row));

      const authorText = [...row.querySelectorAll('a[data-hovercard-url*="/users/"], a[href*="author%3A"], a[href*="author:"]')]
        .map((a) => a.textContent).join(" ");
      const isBot = BOT_AUTHOR.test(authorText) || BOT_TITLE.test(link.textContent.trim());
      row.toggleAttribute("data-gr-bot", isBot);
      row.toggleAttribute("data-gr-draft", !isBot && row.getAttribute("data-gr-state") === "draft");

      if (row.parentElement) lists.add(row.parentElement);
    }
    for (const list of lists) {
      list.setAttribute("data-gr-list", "");
      ensureBotToggle(list);
      ensureDraftToggle(list);
    }
  }

  // Lista de PRs: densidade "Compact" por padrão. Clica uma vez no botão do próprio
  // GitHub (ele guarda a escolha). Se a pessoa escolher "Comfortable" depois, respeitamos.
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

  // Lista: destaca o filtro Open/Closed ativo (o GitHub só muda o peso da fonte).
  // O estado vem da busca (state:/is:), lida da URL ou do campo de busca.
  function tagStateFilter() {
    const q = (new URLSearchParams(location.search).get("q") || document.querySelector("main input[type='text'], main input[type='search'], main [role='combobox']")?.value || "").toLowerCase();
    const cur = /\b(?:state|is):(closed|merged)\b/.test(q) ? "closed" : "open";
    for (const a of document.querySelectorAll("main a[href*='q='], main a[href*='state='], main button")) {
      const m = /^\s*(open|closed)\b/i.exec(a.textContent || "");
      if (!m || a.closest("[data-gr-row], #gr-panel, #gr-cockpit") || a.textContent.length > 40) continue;
      if (!/\d/.test(a.textContent)) continue; // só os toggles com contador ("Open 4", "Closed 90")
      a.setAttribute("data-gr-state-tab", "");
      a.toggleAttribute("data-gr-sel", m[1].toLowerCase() === cur);
    }
  }

  // Botão "N atualizações de bots". É o único nó que inserimos dentro de uma
  // árvore React; fica no fim do contêiner e o CSS (`order`) o posiciona antes
  // das linhas de bot.
  function ensureBotToggle(list) {
    const bots = list.querySelectorAll(":scope > [data-gr-bot]").length;
    let toggle = list.querySelector(":scope > .gr-bot-toggle");
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
      // Ícone do Dependabot (Octicon) e chevron em SVG, no lugar dos caracteres ⚙︎ e ›.
      toggle.innerHTML = `<span class="gr-bot-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M5.75 7.5a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm5.25.75a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5Z"/><path d="M6.25 0h2A.75.75 0 0 1 9 .75V3.5h3.25a2.25 2.25 0 0 1 2.25 2.25V8h.75a.75.75 0 0 1 0 1.5h-.75v2.75a2.25 2.25 0 0 1-2.25 2.25h-8.5a2.25 2.25 0 0 1-2.25-2.25V9.5H.75a.75.75 0 0 1 0-1.5h.75V5.75A2.25 2.25 0 0 1 3.75 3.5H7.5v-2H6.25a.75.75 0 0 1 0-1.5ZM3 5.75v6.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-6.5a.75.75 0 0 0-.75-.75h-8.5a.75.75 0 0 0-.75.75Z"/></svg></span><span class="gr-bot-text">${text}</span><span class="gr-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg></span>`;
    }
  }

  // Grupo "N drafts": mesmo padrão do grupo de bots, logo antes dele.
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
      toggle.innerHTML = `<span class="gr-bot-icon gr-draft-icon" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.25 1A2.25 2.25 0 0 1 4 5.372v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.251 2.251 0 0 1 3.25 1Zm9.5 14a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5ZM2.5 3.25a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0ZM3.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm9.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM14 7.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm0-4.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"/></svg></span><span class="gr-bot-text">${text}</span><span class="gr-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/></svg></span>`;
    }
  }

  // ---------- 3. Página do PR ----------

  // `data-gr-mock-pull` só é usado pelo protótipo local (file://), que não tem a URL /pull/N.
  const isPullPage = () => /\/pull\/\d+\/?$/.test(location.pathname) || root.hasAttribute("data-gr-mock-pull");

  // Cabeçalho: título, selo de estado (Open/Merged...) e branches.
  // O selo é achado pelo texto exato + ícone, perto do <h1>, porque a classe
  // do componente React muda a cada deploy.
  const STATE_TEXT = /^(open|closed|merged|draft|aberto|fechado|mesclado|rascunho)$/i;

  // Nós de texto cujo conteúdo (sem espaços) casa com `re`, fora do markdown.
  // Ir pelo texto, e não por tag, funciona tanto na página antiga (Rails:
  // <h3>, <summary>) quanto na nova (React: <span> dentro de botões etc.).
  function textNodes(scope, re) {
    const found = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => re.test(n.nodeValue.trim()) && !n.parentElement.closest(".markdown-body, #gr-toc, #gr-cockpit, #gr-panel, #gr-modal, script, style, [hidden]")
        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    while (walker.nextNode()) found.push(walker.currentNode);
    return found;
  }

  // O título grande. A página nova também tem um cabeçalho fixo com o título em
  // tamanho pequeno; ficamos com o maior <h1> visível.
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
    // Cabeçalho = o PageHeader do Primer (React) ou o .gh-header antigo; senão, 4 níveis acima.
    let region = h1.closest('[data-component="PageHeader"], .gh-header, header');
    if (!region) {
      region = h1;
      for (let i = 0; i < 4 && region.parentElement; i++) region = region.parentElement;
    }
    markOnly("data-gr-pr-header", region);

    let pill = region.querySelector('[data-component="StateLabel"], .State');
    if (!pill) {
      // Página nova com o estado como botão ("Draft ▾"): sobe do texto até achar o ícone.
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

  // Barra lateral: acha cada seção pelo título (Reviewers, Labels...) e marca as
  // vazias ("None yet", "No reviewers") para virarem uma linha só.
  const SIDEBAR_HEAD = /^(reviewers|assignees|labels|projects|milestone|development|deployments|revisores|responsáveis|etiquetas|projetos|marco|desenvolvimento)$/i;
  const SIDEBAR_EMPTY = /(no reviewers|no one|none yet|no milestone|no deployments|no branches or pull requests|nenhum|ainda não)/i;
  function tagSidebar() {
    // Títulos achados pelo texto, não pela tag: na página nova o título é um
    // <span>/<div> ao lado do botão de engrenagem, e o <h3> antigo não existe.
    const scope = document.querySelector("#partial-discussion-sidebar, [data-component='SplitPageLayout.Pane']") || document.querySelector("main") || document.body;
    const heads = textNodes(scope, SIDEBAR_HEAD).map((n) => n.parentElement);
    const headCount = (el) => heads.reduce((n, h) => n + (el.contains(h) ? 1 : 0), 0);
    for (const head of heads) {
      let section = head.closest("[data-gr-sb]");
      if (!section) {
        // Sobe enquanto o ancestral contiver só este título de seção.
        section = head;
        while (section.parentElement && section.parentElement !== scope &&
               section.parentElement !== document.body && headCount(section.parentElement) === 1) {
          section = section.parentElement;
        }
      }
      // O valor é o nome da seção ("reviewers", "labels"…), lido pelo cockpit.
      section.setAttribute("data-gr-sb", head.textContent.trim().toLowerCase());
      section.toggleAttribute("data-gr-empty", SIDEBAR_EMPTY.test(section.textContent));
    }
  }

  // Número da PR ao lado do título. Na página nova ele só aparece no cabeçalho
  // fixo. Se o título já mostra um "#123" visível, só o estilizamos; senão,
  // acrescentamos um botão nosso (no fim do <h1>, depois dos nós do React).
  const prNumberFromUrl = () => location.pathname.match(/\/pull\/(\d+)/)?.[1] || root.getAttribute("data-gr-mock-pull") || undefined;
  function tagPrNumber(h1) {
    const ours = h1.querySelector(":scope > .gr-pr-num");
    const num = prNumberFromUrl();
    if (!settings.prNumber || !num) { ours?.remove(); return; }

    // "#123" já visível no título ou logo depois dele (fora de .sr-only)?
    const area = h1.parentElement || h1;
    // O texto pode vir quebrado em nós ("#", "104"), então comparamos o textContent do elemento.
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

  // Botão de copiar link ao lado do título (o da barra fixa some enquanto o título está à vista).
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

  // Cabeçalho único: enquanto o título da PR está à vista, a barra fixa de cima não
  // repete o título. Preview, Code, sino e os dois botões de painel viram um só
  // menu "Actions" na barra; os originais do GitHub ficam invisíveis embaixo do
  // nosso botão (para os menus deles abrirem ali) e são acionados pelo menu.
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
      b.innerHTML = `<span></span>${hint ? `<em></em>` : ""}`;
      b.firstChild.textContent = label; if (hint) b.lastChild.textContent = hint;
      b.addEventListener("click", (e) => { e.stopPropagation(); closeActionsMenu(); run(); });
      return b;
    };
    const sep = () => Object.assign(document.createElement("hr"), { className: "gr-am-sep" });
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
        p.preview && sep(),
        p.preview && item("Switch to classic view", () => p.preview.click(), "Preview options"));
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
    const active = !!(settings.enabled && (isPullPage() || /\/pull\/\d+\/(changes|files|commits|checks)/.test(location.pathname)) && p.bar && p.barActs);
    root.toggleAttribute("data-gr-actions-menu", active);
    // Todas as abas da PR usam a tela toda (padrão de Files changed): sem a caixa centralizada de 1356px.
    root.toggleAttribute("data-gr-fullpage", active);
    root.toggleAttribute("data-gr-pr-done", /^(merged|closed|mesclado|fechado)$/i.test(document.querySelector("[data-gr-pr-state]")?.getAttribute("data-gr-pr-state") || ""));
    // Barra fixa só aparece depois que o título sai da tela (ela não ocupa espaço:
    // fica por cima do conteúdo). Antes disso, os botões dela descem para a linha do título.
    const wide = innerWidth >= 768;
    // Desktop: barra só aparece ao rolar. Celular: barra sempre visível (sem repetir o título enquanto ele está à vista).
    const one = active && !!title && title.getBoundingClientRect().bottom > (wide ? 56 : p.bar.getBoundingClientRect().bottom + 4);
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
    if (btn.parentElement !== p.barActs) p.barActs.append(btn);
    // Barra fixa com as mesmas margens do cabeçalho/conteúdo (tela toda): o GitHub
    // centraliza ela numa caixa própria, que não bate com o conteúdo.
    const phEl = title?.closest('[class*="prc-PageHeader-PageHeader-"]');
    if (phEl && wide) {
      const r = phEl.getBoundingClientRect();
      root.style.setProperty("--gr-pad-l", `${Math.max(0, Math.round(r.left - 8))}px`);
      root.style.setProperty("--gr-pad-r", `${Math.max(0, Math.round(document.documentElement.clientWidth - r.right))}px`);
    }
    p.barActs.style.transform = "";
    if (one && wide) {
      const t = title.getBoundingClientRect(), a = p.barActs.getBoundingClientRect();
      const line = title.querySelector("h1, h2") || title;
      const l = line.getBoundingClientRect();
      // Horizontal: a borda direita dos botões acompanha a borda direita do cabeçalho
      // (a barra fixa ocupa a tela toda e deixava os botões colados no canto).
      const ph = title.closest('[class*="prc-PageHeader-PageHeader-"]') || title;
      const dx = Math.round(ph.getBoundingClientRect().right - a.right);
      p.barActs.style.transform = `translate(${dx}px, ${Math.round(l.top + Math.min(l.height, 32) / 2 - (a.top + a.height / 2))}px)`;
      root.style.setProperty("--gr-bar-acts-w", `${Math.round(a.width + 16)}px`);
    }
    // Originais do GitHub: invisíveis, embaixo do nosso botão.
    if (p.acts) {
      p.acts.style.transform = "";
      const a = p.acts.getBoundingClientRect(), b = btn.getBoundingClientRect();
      p.acts.style.transform = `translate(${Math.round(b.right - a.right)}px, ${Math.round(b.top + b.height / 2 - (a.top + a.height / 2))}px)`;
    }
  }
  const queueHeader = () => { if (!headerRaf) headerRaf = requestAnimationFrame(syncHeader); };
  addEventListener("scroll", queueHeader, { passive: true });
  addEventListener("resize", queueHeader);


  // Colunas da Overview: acha o contêiner (conteúdo | barra lateral) a partir das
  // seções da barra lateral, sem depender de classe.
  // pane = maior ancestral das seções que ainda não contém a descrição;
  // cols = o pai dele (contém as duas colunas).
  // Descrição da PR: o primeiro .markdown-body que não está num painel lateral do
  // GitHub (Comments/Activity vêm antes no DOM), num comentário ou nas nossas peças.
  function descBody() {
    return [...document.querySelectorAll("main .markdown-body")]
      .find((b) => !b.closest('[class*="prc-PageLayout-SidebarWrapper-"], article, #gr-panel, #gr-modal, #gr-cockpit')) || null;
  }

  function tagLayout() {
    const secs = [...document.querySelectorAll("[data-gr-sb]")];
    const body = descBody();
    if (secs.length < 2 || !body) return;
    // Barra lateral dentro da aba Details do painel: mantém as marcas que já existem.
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
  // Garante um único elemento com o atributo (a página muda sem recarregar).
  function markOnly(attr, el) {
    for (const old of document.querySelectorAll(`[${attr}]`)) if (old !== el) old.removeAttribute(attr);
    el?.setAttribute(attr, "");
  }

  const STATUS_TEXT = /^(approvals?|aprovações)$/i;
  const PREVIEW_TEXT = /^preview$/i;

  // Caixa de merge da Overview nova ("Some checks are waiting…" + Checks |
  // Comments | Approvals). Do texto "Approvals" sobe até o maior bloco que
  // ainda não contém a descrição.
  function tagMergeBox(scope) {
    const node = textNodes(scope, STATUS_TEXT).find((n) => !n.parentElement.closest("nav, [role='tablist'], #gr-cockpit"));
    const body = descBody();
    let el = node?.parentElement;
    // Página clássica (aba Conversation): a caixa de merge tem id fixo.
    if (!el) return markOnly("data-gr-mergebox", document.querySelector("#partial-pull-merging"));
    if (!body) return markOnly("data-gr-mergebox", null);
    while (el.parentElement && el.parentElement !== scope && !el.parentElement.contains(body)) el = el.parentElement;
    markOnly("data-gr-mergebox", el);
  }

  // Cartão da descrição: o primeiro .markdown-body, subindo enquanto o ancestral
  // não tiver outros comentários nem a caixa de merge.
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

  // Seletor "Preview ▾" do GitHub (liga/desliga a interface nova): destacamos
  // para quem quer voltar à antiga.
  function tagPreviewToggle() {
    const node = textNodes(document.querySelector("main") || document.body, PREVIEW_TEXT)
      .find((n) => n.parentElement.closest("button, summary, [role='button']"));
    const btn = node?.parentElement.closest("button, summary, [role='button']");
    if (btn) {
      markOnly("data-gr-preview-toggle", btn);
      if (!btn.title) btn.title = "Open to switch back to the classic pull request page";
    }
  }

  // Índice da descrição: um botão flutuante (nó nosso, fora da árvore React)
  // que lista os títulos do markdown e destaca a seção visível.
  let tocObserver = null;
  function updateToc() {
    // O React redesenha a descrição: sempre buscamos os títulos atuais (os antigos
    // saem da página e scrollIntoView neles não faz nada).
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
      <button type="button" class="gr-toc-pill"><span>☰</span> Contents <em>${heads.length}</em></button>`;
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
        // scrollIntoView funciona mesmo se a página rolar dentro de um contêiner;
        // a margem desconta o cabeçalho fixo do GitHub, que cobriria o título.
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

  // Saldo de linhas ao lado do "+52 −6": quanto código a PR acrescenta de fato.
  function tagNetDiff() {
    const scope = document.querySelector('[class*="prc-PageLayout-HeaderContent"], [data-gr-pr-header]');
    let net = document.querySelector(".gr-net");
    // Elementos-folha com "+52" e "−6" (o texto pode vir quebrado em nós, então usamos textContent).
    const leaves = scope ? [...scope.querySelectorAll("span, strong, div, a")].filter((e) => !e.closest(".gr-net, .sr-only, [class*='VisuallyHidden']") && e.getClientRects().length && ![...e.children].some((c) => c.textContent.trim())) : [];
    const plusEl = leaves.find((e) => /^\+\s*[\d,]+$/.test(e.textContent.trim()));
    const minusEl = leaves.find((e) => /^[-−–]\s*[\d,]+$/.test(e.textContent.trim()));
    if (!plusEl || !minusEl) { net?.remove(); return; }
    const n = (e) => +e.textContent.replace(/[^\d]/g, "");
    const add = n(plusEl), del = n(minusEl), diff = add - del;
    // Depois dos quadradinhos do diffstat, se existirem; senão logo após o "−6".
    let after = minusEl;
    for (let el = minusEl.nextElementSibling; el; el = el.nextElementSibling) after = el;
    if (minusEl.parentElement !== plusEl.parentElement && minusEl.parentElement?.nextElementSibling === null) after = minusEl.parentElement;
    if (!net) { net = document.createElement("span"); net.className = "gr-net"; }
    net.textContent = `${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${Math.abs(diff).toLocaleString("en-US")} net`;
    net.title = `${add} added − ${del} removed = ${diff} lines`;
    net.dataset.sign = diff > 0 ? "up" : diff < 0 ? "down" : "zero";
    if (after.nextElementSibling !== net) after.after(net);
  }


  // Blocos que só poluem a Overview: o aviso "Looking for an old friend?" e a seção
  // "Activity (since you last interacted)" da barra lateral (o Activity completo segue no botão do topo).
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

  // Janelas do GitHub (ex.: "Some checks were not successful" ao clicar no status
  // de checks na lista) abrem como gaveta à direita, no mesmo padrão das conversas.
  // Só marca o nó (o React continua dono dele); o CSS faz o resto.
  function tagDrawerDialogs() {
    for (const d of document.querySelectorAll("[role='dialog']:not([data-gr-drawer]), dialog.Overlay:not([data-gr-drawer])")) {
      if (d.closest("#gr-modal, #gr-panel, [class*='prc-PageLayout-SidebarWrapper-']") || d.querySelector("[role='menu'], [role='listbox']")) continue;
      const head = (document.getElementById(d.getAttribute("aria-labelledby") || "")?.textContent
        || d.querySelector("h1, h2, h3, [class*='Title'], [class*='title']")?.textContent || d.getAttribute("aria-label") || "").trim();
      // checks, status de entrada na fila de merge ("Queue entry status details")
      if (/\bchecks?\b|status details/i.test(head) || /^entry-status-dialog/.test(d.id)) d.setAttribute("data-gr-drawer", "");
    }
  }

  // Painel Merge status: marca o tipo de cada grupo de checks (cor do marcador) e
  // a mensagem de "Merging is blocked" que só repete o que outra seção já disse.
  const CHECK_KIND = [[/fail|error|cancel/i, "fail"], [/pending|expected|queued|waiting/i, "pending"], [/in progress|running/i, "progress"],
    [/skipped/i, "skipped"], [/neutral/i, "neutral"], [/success/i, "success"]];
  // "Merge when ready" / merge queue / auto-merge: o GitHub troca o painel inteiro
  // por uma tela só com "Confirm …" e "Cancel". Esse passo é reversível (dá para
  // tirar da fila ou desligar o auto-merge), então confirmamos sozinhos logo depois
  // do clique da pessoa. Merge direto (irreversível) continua pedindo confirmação.
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
    // Revisores ("1 approval", "1 pending review"): o GitHub só mostra os nomes ao
    // expandir. Expandimos uma vez cada grupo, para ver quem aprovou sem clicar.
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

  // Página da fila de merge (/queue/<branch>): status de cada entrada visível como
  // selo (o GitHub só mostra um ícone com tooltip).
  function tagQueuePage() {
    const on = /\/queue\/[^/]+/.test(location.pathname);
    root.toggleAttribute("data-gr-queue", on);
    if (!on) return;
    for (const b of document.querySelectorAll(".hx_merge_queue_entry_status_icon")) {
      const t = (b.getAttribute("aria-labelledby") || "").split(" ").map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(" ")
        || b.getAttribute("aria-label") || "";
      if (t && b.getAttribute("data-gr-label") !== t) b.setAttribute("data-gr-label", t);
    }
  }

  function tag() {
    if (!settings.enabled) {
      document.getElementById("gr-toc")?.remove();
      document.querySelectorAll(".gr-pr-num, .gr-copy-link, .gr-net").forEach((el) => el.remove());
      GRCockpit.update({ settings, root, textNodes });
      syncHeader();
      return;
    }
    observer.disconnect(); // não reagir às nossas próprias mudanças
    try {
      tagDrawerDialogs();
      tagQueuePage();
      tagMergePanel();
      if (isPullPage()) tagPullPage();
      else { if (/\/pull\/\d+\//.test(location.pathname)) queueHeader(); // Files changed, Commits, Checks: mesmo cabeçalho
        tagListRows(); preferCompact(); tagStateFilter(); updateToc(); GRCockpit.update({ settings, root, textNodes }); } // fora da Overview: desmonta cockpit/modal
    } finally {
      observe();
    }
  }

  observe();
  document.addEventListener("turbo:load", scheduleTag);
  window.addEventListener("popstate", scheduleTag);
})();
// Versão carregada (para conferir no console se a extensão foi recarregada).
document.documentElement.setAttribute("data-gr-version", chrome.runtime?.getManifest?.().version || "dev");
