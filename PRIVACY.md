# Privacy Policy — Refine for GitHub

_Last updated: November 12, 2026_

Refine for GitHub is a browser extension that changes how github.com pages look. This policy explains what data it handles.

## What the extension does with data

- **It reads the GitHub page you have open** (in your browser, locally) to find elements such as pull request titles, checks and conversations, and restyles them. This content never leaves your browser.
- **It stores two preferences**: whether the extension is on, and your accent color. They are saved with Chrome's `storage.sync`, so Chrome may sync them across your signed-in browsers. A copy is cached in the page's local storage on github.com to avoid a flash of unstyled content.
- **It may load collapsed conversations from github.com.** On older pull request pages, some review conversations are collapsed and GitHub loads them only when expanded. The extension requests those same github.com URLs, with your existing session, so it can show the conversation. The response stays in your browser.
- **It uses GitHub's own buttons.** Actions in the extension (for example "Reply" or "Resolve") click GitHub's own buttons on the page, as if you clicked them. A few convenience steps click GitHub controls for you: switching list density to Compact (once, unless you pick Comfortable), expanding the reviewer groups in the Merge status panel, and confirming "Merge when ready" right after you click it.

## What the extension does not do

- It does not collect, log or transmit personal data, browsing history or page content.
- It does not use analytics, tracking, cookies or advertising.
- It does not call the GitHub REST or GraphQL APIs and does not ask for tokens or passwords. The only requests it makes are to github.com pages, as described above.
- It does not load remote code. All scripts and styles are part of the installed package.
- It does not sell or share any data with third parties.

## Permissions

- `storage`: to save the two preferences above.
- Access to `https://github.com/*`: to restyle GitHub pages. No other website is accessed.

## Contact

Questions about this policy: open an issue on the project's repository or contact the developer through the Chrome Web Store or Firefox Add-ons listing.
