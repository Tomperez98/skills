# Migrations and removals

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Never rename or drop a column, table, or field in place. Expand, then contract: add the new shape (nullable or defaulted), write both, backfill, switch reads, stop writing the old one, then drop it in a later deploy.
- A schema change and the code that needs it ship in separate deploys: schema first for an expansion, code first for a contraction. A rolling deploy runs N-1 and N together even for a single service.
- An expansion rolls back by redeploying the old code. The contraction (a drop or destructive rewrite) is a one-way door: show it's unused, then stop and ask. Don't promise a down migration for a drop; fix forward.
- Backfill in bounded, throttled batches keyed on a cursor, off the request path. A backfill is idempotent, resumes from its last cursor, and logs progress.
- Build indexes and constraints without blocking writes (`CREATE INDEX CONCURRENTLY`, or add a constraint as `NOT VALID` and then validate it), and give every migration a lock timeout.
- Before removing code, an endpoint, a column, or a flag, show zero use: metrics or logs over a full business cycle, plus a search of every call site. "Nobody uses it" without evidence is a guess.
- Deprecate only once the replacement covers the old path's critical uses in production. Whoever deprecates migrates the callers or files the change for each owner. No new features land on the deprecated path.
- Removing anything callers of the last release can reach follows the compatibility rules: deprecate, warn on use, and name the removal version.
