# lib/retry.js

Registered on `globalThis.GRLib`, exported for Node. Source: [`extension/lib/retry.js`](../../extension/lib/retry.js).
Tests: [`test/retry.test.js`](../../test/retry.test.js).

## API

- `const sleep = (ms)`
- `async function retry(fn, { retries = 3, base = 200, max = 5000, shouldRetry = () => true } = {})`
