# Architecture

Refine is three layers (see the header of `extension/src/content.js`):

1. **Settings → attributes** on `<html>` (`data-gr-*`), so CSS applies instantly.
2. **Semantic tagging**: we find GitHub's elements by stable hints and write our own attributes.
3. **CSS** scoped by those attributes.

## `extension/lib/`

Since 1.3.0 the pure logic lives in small files under `extension/lib/`. Each one:

- is a classic script (no bundler, no ES modules — content scripts cannot import);
- registers itself on `globalThis.GRLib.<name>` in the browser;
- exports the same object through `module.exports` under Node, for the unit tests in `test/`.

Load order matters: the manifest lists `src/settings.js`, then the lib files, then
`src/cockpit.js` and `src/content.js`. A lib file may use another lib file only if it
is listed after it.

## Golden rule

Never move or remove nodes React controls. Reorder with CSS `order`, hide with
`display: none`. The nodes we add (`.gr-*`, `#gr-*`) are re-inserted if React drops them.
