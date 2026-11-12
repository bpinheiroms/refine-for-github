# Security policy

## Supported versions

Refine for GitHub is released from `main`. Security fixes go to `main` and ship in the next Chrome Web Store and Firefox Add-ons version; only the latest published version receives them.

| Version | Supported |
| --- | --- |
| Latest store version (Chrome Web Store, Firefox Add-ons) and `main` | Yes |
| Older versions | No |

## Reporting a vulnerability

Please do not open a public issue, discussion or pull request for a security problem.

Report it privately through GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**, or go to <https://github.com/bpinheiroms/refine-for-github/security/advisories/new>.

Include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- the affected version or commit,
- any suggested fix.

You should receive an acknowledgement within a few days.

## Scope

Areas where reports are especially valuable:

- content from a GitHub page (pull request title, description, comment) that ends up executed as script or HTML by the extension;
- the extension clicking a GitHub control the user did not intend (merge, close, resolve) because of page content;
- any request to a site other than github.com, or any leak of page content outside the browser.

The extension has no backend, collects no data and asks only for the `storage` permission and access to `https://github.com/*`.
