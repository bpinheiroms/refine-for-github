// Settings shared by the content script and the popup.
// Each boolean key becomes a `data-gr-<key>` attribute on GitHub's <html>, and
// all of the extension's CSS is scoped by those attributes. Turning an option
// off removes the attribute and GitHub goes back to normal, without a reload.
const GR_DEFAULTS = {
  enabled: true,   // master switch
  theme: true,     // palette, typography and radii through Primer tokens
  cards: true,     // PR/issue lists as cards with a state stripe
  groupBots: true, // bot PRs (dependabot, renovate, build(deps)) collapsed at the end of the list
  dimDrafts: true, // dimmed drafts
  readable: true,  // more readable markdown descriptions/comments
  toc: true,       // PR page: floating table of contents for the description
  compactSidebar: true, // PR page: empty sidebar sections on a single line
  prNumber: true,  // PR page: #number next to the title (click to copy)
  cockpit: true,   // PR page: Overview becomes "what's left to merge" (read from the page itself)
  oldModeHint: true,   // PR page: highlights the "Preview" switch to go back to the classic UI
  debug: false,    // outlines the elements the extension recognized
  accent: "violet" // violet | blue | green | orange
};

const GR_CACHE_KEY = "gr-settings-cache";
