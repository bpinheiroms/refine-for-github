# Testing

```bash
npm test            # node --test, no dependencies
npm run test:watch
npm run check       # node --check on every script
```

Unit tests cover `extension/lib/` only; everything that reads GitHub's page is checked
on the test bench (see the README) because GitHub's markup can only be validated
against a real, logged-in page.

Tests use `node:test` and `node:assert/strict`. Timers are mocked with
`t.mock.timers`. Browser globals (`chrome`, `navigator`, `document`) are stubbed per test
file; keep stubs minimal and local.
