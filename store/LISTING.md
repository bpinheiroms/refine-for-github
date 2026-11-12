# Chrome Web Store listing — Refine for GitHub

Everything to paste into the Chrome Web Store Developer Dashboard
(https://chrome.google.com/webstore/devconsole).

## Package

- Upload: `dist/refine-for-github-<version>.zip` (run `./scripts/package.sh`)
- Version: see `extension/manifest.json`

## Store listing tab

**Name** (from the manifest): Refine for GitHub

**Summary** (from the manifest, 132 chars max):
A cleaner GitHub pull request page: what's left to merge, conversations in a side panel, compact lists and checks.

**Category:** Developer Tools

**Language:** English

**Detailed description:**

```
Refine for GitHub is a design layer on top of github.com. It reorganizes the pull request page around one question: what is left before this can be merged?

PULL REQUEST OVERVIEW
• "N things left before merging": failing checks, missing approvals, conflicts and unresolved conversations, each with its own action button.
• A side panel with Open, Resolved, Comments and Details tabs. Open conversations show who replied last, so you know where you're expected to answer.
• Click a conversation to read it in a drawer and reply or resolve without leaving the page.
• One compact header: title, status and a single Actions menu.
• Net lines added (+N net) next to the diff stats.

MERGE STATUS AND CHECKS
• Checks grouped by state (failing, pending, in progress, skipped, successful) with colored markers.
• Reviewers listed without extra clicks.
• Merge status, Comments, Activity and check details open as a right-side drawer instead of a centered dialog.
• Merge queue page with visible entry status and stat cards.

LISTS
• Pull request and issue lists as cards with a colored state stripe.
• Drafts and dependency updates (Dependabot, Renovate) grouped and collapsed at the end of the list.
• Clear selected state on the Open/Closed filter. Compact density by default.

LAYOUT
• Full-width pages, aligned margins, the right panel grows on wide screens.
• Works on narrow windows and mobile layouts.
• Pick an accent color (violet, blue, green, orange) or turn everything off from the toolbar popup.

PRIVATE BY DESIGN
• No account, no token, no GitHub API calls. The extension only reads and restyles the page you already have open.
• No analytics, no tracking, no remote code. Your two settings (on/off and accent color) are stored with Chrome sync storage.
```

**Screenshots** (1280×800): `store/screenshots/`
1. `1-overview.png` — Overview with "things left before merging" and the side panel
2. `2-conversation-drawer.png` — a code conversation opened in the drawer
3. `3-files-changed.png` — Files changed with the unified header

**Small promo tile** (440×280): `store/promo-small-440x280.png`
**Marquee promo tile** (1400×560, optional): `store/promo-marquee-1400x560.png`
**Store icon** (128×128): `store/icon-128.png`

## Privacy practices tab

**Single purpose:**
Improve the layout and readability of github.com pages, mainly pull requests, by restyling the page the user is viewing.

**Permission justification**

| Permission | Why |
| --- | --- |
| `storage` | Saves the user's two preferences (extension on/off and accent color) so they persist between sessions and devices. |
| Host permission `https://github.com/*` | The content script and stylesheet run only on github.com pages to restyle them. No other site is accessed. |

**Remote code:** No, I am not using remote code. All JavaScript and CSS ship inside the package.

**Data usage:** The extension does not collect or transmit any user data. Tick none of the data categories.

Certify the three statements:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://gist.github.com/bpinheiroms/8629584043c4948f0b6706369979874a

## Distribution tab

- Visibility: Public (or Unlisted to share only by link first)
- Regions: All regions
- Pricing: Free

## Trademark note

The name follows GitHub's guidance for third-party tools ("<Name> for GitHub"), and the icon does not use the GitHub logo or Octicons. The extension is not affiliated with or endorsed by GitHub, Inc.; this is stated in the description footer below if a reviewer asks:

```
Refine for GitHub is an independent project and is not affiliated with, endorsed by or sponsored by GitHub, Inc. GitHub is a trademark of GitHub, Inc.
```
