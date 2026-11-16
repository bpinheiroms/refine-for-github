# Telemetry

Refine can send anonymous usage counters so we know which features are worth keeping.

- **Opt-in**: nothing is sent unless `telemetry` is turned on.
- **What**: the event name (`settings`, `stack-open`, `shortcut`) and its properties.
  No repository names, no URLs, no titles, no logins.
- **When**: batched, at most once per hour, and when the tab closes.
- **Where**: `telemetry.refine-for-github.dev`.

See `extension/lib/telemetry.js`. The flag lives in `extension/lib/feature-flags.js`.
