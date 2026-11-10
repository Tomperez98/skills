# Compatibility

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Check both layers. A schema diff can't see that a valid order now gets a 409. A behavior check can't see a renamed field the old suite never read.
- Shape: diff the schema or public API against the last released tag with a tool that classifies each change as breaking or not. Run it in the fast tier on the schemas the PR touched, and on all of them on main and release. If the schema is generated, regenerate it in CI and fail on a diff.
- Reserve a removed identifier (enum value, field number, event type, operation name) forever.
- Adding something breaks callers that match exhaustively or build structs literally. Mark an enum or struct that will grow as open from its first release (`#[non_exhaustive]`, a required default branch, an unknown-value case). Closing it later is a break.
- Behavior: write it as an executable spec that maps (request, state) to correct responses and sees the system only through its API. Assertions scattered across tests can't judge the next build. The spec must be deterministic and replayable.
- Ship the contract (schema, spec, generated sequences) with the release and list it in the manifest. If the last release shipped none, write the spec on main and run it against the last published artifact. Green means freeze it as the baseline. Until then, every change reports *baseline*, not *additive*.
- On every PR that can change behavior, run the last release's suite against the new build. Judge it with the old spec, not a byte-for-byte match, since IDs, timestamps, and ordering legitimately change. Decide "can change behavior" mechanically, from a checked-in map of each spec to the source paths it reaches.
- A release build is judged against the release before it. Everything else is judged against the latest release at or before the commit.
- Every failure is either a bug (fix it) or a deliberate break. A deliberate break needs a breaking changelog entry with a migration note, which forces a major bump. CI fails a compatibility failure that has no breaking entry.
- Declaring a break is a one-way door: show the failing check and the proposed entry, then wait for yes. Fixing the change so the check passes needs no permission.
- Result levels: undeclared break is an error. Declared break is a notice. A promise reworded or removed while the old contract stays green is a warning for a spec owner. New promises only, or no change, is silent.
- Prefer deprecation to removal: keep the old behavior for at least one release, warn on use, and say in the changelog when it goes away.
- When classifying a change you wrote yourself, review it in a fresh context (a subagent if available). First check that the baseline tag resolves and the diff is non-empty, then paste in the diff and the check outputs. Ask for one line per change, `file:symbol | shape or behavior | level | evidence`, and "unchecked" where no check covers it. Report its lines as written.
- Run concurrency, fault-injection, and deep-exploration suites on a schedule against main and against the frozen commit before a release, judged by the released contract.
