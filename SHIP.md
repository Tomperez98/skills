# SHIP.md

Rules for CI, compatibility, releases, publishing, rollout, and watching main. These rules are language-, framework-, and tool-agnostic. Examples are pseudocode, so translate the shape to the project's stack, and let repo conventions decide mechanics. If a skill or process framework is available, it owns the workflow. Apply these rules inside each step. On conflict, these rules win. Say so when you override one.

**One rule: keep main releasable and make every release boring: scripted, re-runnable, verified.** Any commit on main could ship as it is. The only manual parts are the decisions: which commit, and "go". A release that fails halfway runs again without burning a version. Verification reads what users get, not what you meant to ship. Pipelines follow the code rule too: a broken precondition (the version already holds different bytes, the tests didn't run) is a bug, so stop loudly. A network or registry failure is expected, so retry it with bounds or report it.

## Terms
- **Contract:** what users rely on, in two layers. **Shape** is the schema and signatures. **Behavior** is what the system does with a well-formed call. A **promise** is one behavior rule: `"<situation> → <outcome>"`.
- **Break:** a contract change that a caller of the last release can notice. A **declared** break has a breaking changelog entry and a major bump. Any other break is undeclared and fails the build.
- **N-1, N:** the last release and the one being built. The **window** is the range of versions that must work together during a rollout.
- **Frozen commit:** the SHA, resolved from remote main, that a release ships, and nothing else.
- **One-way door:** a step that can't be undone (publish, declared break, re-tag, overwrite). Stop and ask there. Every other step is a two-way door and runs without asking.

## CI
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

## Compatibility
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

## Review routing (where behavior is an executable spec)
- Label every PR by what it does to the contract. **Unchanged:** no spec or schema change, and specs green in both directions. **Additive:** new operations or outcomes, old contract still green; one spec owner approves. A new value in a closed set is breaking. **Breaking:** the old contract rejects the build; spec owners approve the declared break. **Baseline:** the first contract; blocks nothing.
- Put spec and schema directories under named owners (`CODEOWNERS`).
- Post the PR's own promise diff (against its base, not the last release), which side moved, and a runnable replay of every failure. Fail the build when a public operation has no spec, a spec rule never runs, or a test asserts on responses itself.
- The job that checks PR code holds a read-only token and uploads its verdict as data. A separate job triggered by its completion (`workflow_run` on GitHub) holds the write token, checks out only the base, and validates the verdict as untrusted input. It applies the verdict idempotently as a label and a check, only if the verdict matches the current head and base. Recompute the verdict in the merge queue.
- Treat labels as information until the specs have caught real bugs. Only then let "unchanged" merge on green alone.
- Watch the gate's numbers: the share of additive or breaking PRs, flake rate, verdict latency, and owner approval time. Version a hot surface or move it behind a stable boundary.

## Watching main
- Run suites too slow for PRs (version matrix, soak, property, concurrency, end-to-end) on main and report per commit or commit range. Bisect a failing range to one commit. Releasing a commit requires these to be green.
- Record the numbers users would feel (build time, artifact size, latency, memory) on every merge, from the shipped build. Watch the trend. A person decides whether a jump is a regression or a trade-off.
- Re-run release validation on a schedule: registries, base images, external APIs, and toolchains change without your repo changing.
- Every failure reaches a person. Keep one tracking issue per failing job: the first failure opens it, later failures comment on it, and the first green run closes it.

## Releases
- Keep the release checklist in the repo: numbered steps, exact commands, the reasoning after the steps, and a recovery procedure for each failure mode (partial publish, validation bug, bad release). Script every step you can.
- Never rush a change into a release. If unsure a release is ready, skip it. A regular cadence (e.g. weekly) makes skipping cheap. Ask the user when cadence or versioning scheme is their call.
- Keep the version in one place. Strongest form: the top changelog entry is the only source. Every manifest pins a placeholder (`0.0.0-dev`), and the release build stamps the real version into a temporary copy.
- Change the version in a reviewed PR. Derive the candidate from the last changelog entry and the changes since, and let the compatibility checks pick the bump.
- Build the changelog entry from the list of changes merged since the last release, then edit it for readers. A skipped release keeps its entry, marked unreleased, and the next release merges it in.
- Release a frozen commit. A script resolves remote main to a SHA and tags that. Never tag from a local checkout.
- Before publishing, confirm green for the frozen commit: CI, post-merge checks, compatibility, and the rollout test. Open failures must be triaged and metric jumps explained. Otherwise skip the release.
- Stop and ask once, before the first upload: show the commit, the version, and the changelog entry, then wait for "go".
- Published versions are immutable; fix forward through the same process, fast enough to run several times a day. If a fix seems to need an overwrite, re-tag, or re-publish, stop and ask. Yank or deprecate a dangerous release and tell users how to move off it. Write the emergency procedure down before you need it.

## Publishing
- Separate `build --commit=<sha>` (no secrets, runs anywhere) from `publish --commit=<sha>` (protected job only). The build's output directory is the release. Generate install commands for the release notes from the build.
- Build once, test, and publish those exact bytes. Embed the version (and commit) in the artifact and assert it reports what you meant to build.
- Write a manifest beside the artifacts: name, version, commit, a checksum per file, and the contract files. Verification and resuming a partial publish read it, never memory or a re-glob.
- When stamping a version, assert the placeholder was found, so a renamed field fails the build instead of shipping `0.0.0`.
- Before any upload, assert the preconditions. Published files must be a subset of the built ones with the same checksums. The version must be new, or a partial publish of these exact bytes, and must be greater than the registry's latest. CI must have passed for this commit: ask CI or run the same definition, never a pasted copy. The built set must equal a hand-written expected artifact list, never whatever a glob finds.
- A version holding different bytes is taken: fail and bump. A version holding some of these bytes is a partial release: continue.
- Every way of starting a release runs every check. If publishing waits for approval, re-check right before the first upload.
- Each step checks whether it's already done and skips. Order: stage (draft release or staging repo), publish to each registry, then make it visible (release page, `latest`, announcement). Non-install steps like a docs rebuild come after it's visible. Bound network retries, then fail clearly.
- Credentials: available only to the release job, in a protected environment with an approval step, usable only from release tags. The job checks out that ref explicitly. The job holding the credential runs nothing but the upload; build and test run elsewhere and hand over the artifact. Release jobs build from a clean cache.
- Prefer short-lived credentials (OIDC, trusted publishing). Otherwise use one token per target, narrowly scoped, with an expiry and a written rotation procedure. No `set -x` in the job that holds a secret; mask it, and on failure report only the registry and the status.
- Only one release runs at a time, and it's never cancelled mid-way. Validation shares the lock. A failed release alerts someone.
- Verify from outside, after each publish and on a schedule, in a separate job. Every expected artifact downloads from where users get it. It matches the build by checksum, or by unpacked contents if a registry repackages. It installs into a clean environment from the public registry and passes a smoke test on the newest toolchains. `latest` points at it everywhere. Poll caches with a time limit.
- Run validation code from main against the latest released tag, but compare against the release's stored artifacts and use its own examples and fixtures. A mismatch fails loudly with the artifact name and both values.

## Rollout (several services)
- Release services in lockstep under one version, so the only pair that must work together is N-1 and N. Split one out only when it truly needs its own cadence; it then gets its own version, tag prefix, and baseline. Ask the user when lockstep or the window size is their call.
- Green at HEAD proves nothing about a rollout. On every PR that touches a contract between services, run N-1's suites against N (backward) and N's suites against N-1 (forward). Run only the directions your enforced deploy order can produce. A forward failure on a promise new in N is an ordering requirement: ship the provider first.
- Script the deploy order (usually providers first) and test exactly that: start everything at N-1, upgrade one at a time, specs judging throughout. Run it before each release and on a schedule with faults injected.
- Enforce the window at runtime: callers announce their version, and anything outside N-1..N gets a clear "too old" or "too new" error. A wider window (rollbacks, on-prem installs) keeps one shipped contract per supported version, each checked. Width is a cost you choose.
- Queued events and stored rows were written by N-1. Replay N-1's recorded events through N's specs, and migrate a copy of N-1's data and read it back through N's API. Widen readers before data loosens, and add a new shape before the code that writes it.
