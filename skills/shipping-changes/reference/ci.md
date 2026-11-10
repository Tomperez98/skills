# CI

Part of the shipping-changes skill. The core rules and Terms in [SKILL.md](../SKILL.md) still apply.

- Put the whole suite behind one command (`make ci`, `./ci`) that behaves the same on a laptop and in CI. The CI config only sets up the environment and calls it.
- Give the tiers names (fast, unit, slow) so a developer can run one and CI can shard the rest. Asking for a tier that doesn't exist fails; running nothing and reporting success looks like green.
- Multi-service repo: a PR runs the suites of the services it changed and of every service downstream in the dependency graph. Main and the release run everything.
- Test the merged result. Main moves only to commits that passed. Require up-to-date branches while merges arrive slower than one per CI run (about 30/day for a 15-minute suite). Above that, use a merge queue.
- Cancel superseded runs on PRs only. Every commit on main keeps its own result.
- Pin toolchains, dependencies, ad hoc tools (`npx tool`, `uvx tool`), and CI actions, preferably to a checksum or commit SHA. Pin each version in one place that both a laptop and CI read, ideally one the tool enforces itself (`required-version`). A "keep in sync with X" comment is a second copy, and it drifts.
- Jobs get no permissions or secrets by default and ask for exactly what they need. Cache only what's derived from pinned inputs, keyed on the files that pin them.
- Every failure is reproducible: log the seed and print the replay command. Quarantine a flaky test with an owner; never retry until green. Exceptions: a concurrency check that fails now and then is the race it exists to find, so keep it red. A contract check that gates every PR is never quarantined; make it deterministic instead.
- Passing steps are quiet and failing steps print full output: the failed step, the failed command, and how to run it locally. Give heavy steps a timeout and a resource limit, so a hang fails a named step.
- When reviewers keep catching the same problem, make it a check. Ban an API with the replacement named in the error message. Also check for leftover debug code and stale generated files (regenerate and diff).
- Build the release in dry-run mode on every merge: build every artifact, publish nothing.
- Fail on source files nothing references, file types outside an allowlist, and broken internal doc links. When a page moves, add a redirect from the old address.
