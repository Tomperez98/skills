# State and configuration

Part of the writing-code skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Prefer a config option with a visible default over a global, so tests override it without touching process-wide state.
- Read the environment once, at the edge (`main` or the CLI parser), into a typed value. No `getenv` below that line. The parser takes `env` as a parameter.
- Every config value is required. A missing or malformed value fails at startup and names the variable. Never fall back to a dev default.
- Give each function the narrowest slice it uses (a `DbUrl`, not `Config` or `App`), one hop deep: no `order.customer.account.address.city` (Law of Demeter). In a request, load only the rows it reads.
- Pass and cache IDs across boundaries, not hydrated objects. Version mutable things (etag, row version) so a stale write fails loudly (404/409).
- Declare data invariants in the store (`NOT NULL`, `UNIQUE`, `CHECK`, FKs). An app-side check is only for friendlier errors. Map violations once: user-causable ones are expected errors, code-only ones are bugs. Test each constraint by writing the bad row with raw SQL.
