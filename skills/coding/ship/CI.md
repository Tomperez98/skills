# Continuous integration

You're setting up, fixing, or speeding up the checks that gate a merge. CI
keeps main releasable only if everyone can run it, it gives the same answer
every time, and a failure points at its cause. Apply the rules in order.

## 1. CI is code in the repo, runnable locally

Put the whole check suite behind one command that behaves the same on a laptop
and on a CI runner (`make ci`, `./ci`, or your task runner's `ci` task). The CI
config only sets up the environment and calls that command. Logic that lives
only in CI config can only be debugged by pushing commits.

```yaml
# The CI config is glue: set up, then call the same command a developer runs.
- run: ./scripts/setup
- run: ./ci
```

## 2. Fast checks first, full checks on demand

Order the suite by cost: formatting, linting, and compiling first, then
unit tests, then slow integration or end-to-end suites. Give the tiers
names so a developer can run just the fast part and CI can spread the slow
parts across machines. If someone asks for a tier that doesn't exist, fail.
Running nothing and reporting success looks exactly like a green build.

In a repo with several services, a pull request runs the suites of the
services it changed and of every service downstream of them in the
dependency graph. A change to a shared schema or library changes every
service that uses it. Main and the release run everything.

## 3. Test what will land, not just the branch

A branch that passes on its own can still break main once merged. Test the
result of merging into current main, and only let main move to commits that
passed. Every merge waits for green.

Requiring the branch to be up to date does this by serializing merges: each
one rebases and reruns CI behind the last. That suits a low merge volume,
roughly while merges arrive less often than one per CI run (under about 30
a day for a 15-minute suite). Above that, use a merge queue, which tests
queued merges together and keeps the line moving.

Cancel superseded runs on pull requests only. Every commit on main keeps
its own result, so a release (RELEASE.md rule 5) and a regression hunt
(MONITOR.md rule 1) always have a green commit to point at.

## 4. Make runs reproducible

The same commit should give the same result today and next month.

- **Pin the inputs:** toolchain versions, dependencies (DEPENDENCIES.md),
  and third-party CI actions, preferably to an immutable reference such as
  a checksum or commit SHA rather than a tag that can move. Pin each
  version in one place that both a laptop and CI read, ideally one the
  tool enforces itself (such as a `required-version` setting), so a
  mismatch fails at once. A "keep in sync with X" comment is a second
  copy, and it drifts. Tools you run ad hoc are inputs too: an unpinned
  `uvx tool` or `npx tool` picks up each new release, and a scheduled run
  goes red with nothing in the repo changed. Lock them with the project's
  dependencies.
- **Least privilege:** jobs get no permissions or secrets by default. Each
  job asks for exactly what it needs.
- **Cache only what's derived from pinned inputs,** keyed on the files that
  pin them, so a cache can never change what a run does.

## 5. Every failure can be reproduced

A failure you can't reproduce is noise. When a test uses randomness, log
the seed and print the command that replays it. Treat a flaky test as a
bug: fix it, or quarantine it with an owner; a retry-until-green hides
real failures. A concurrency check that fails now and then is not flaky:
it's the race it exists to find, so keep it red until the race is fixed
(COMPAT.md rule 7). A contract check that gates every pull request stays out
of quarantine: make it deterministic and replayable (COMPAT.md rule 3) and
fix a flaky one now.

## 6. Make failures easy to read

Keep passing steps quiet and give failing ones full output. Point at the
step that failed, the command that failed, and how to run it locally. Give
heavy steps a timeout and a resource limit, so a hang or running out of
memory fails a named step instead of looking like the infrastructure
flaking.

## 7. Automate the review checklist

If reviewers keep catching the same kind of problem, make it a check:
formatting, lint rules, banned APIs (with the replacement in the error message),
leftover debug code, and generated files that weren't regenerated. The same goes
for breaking changes: run the compatibility checks and the undeclared-break
gate (COMPAT.md rules 2, 5, and 6). A pull request that changes a contract
between services also gets a reviewer whose only question is whether N-1 and
N still work side by side (ROLLOUT.md rule 2). Where behavior is an
executable spec, let the contract change route the rest of the review
(REVIEW.md).

Gate the build on the strict settings in code's WRITE.md rule 10. If CI
allows one warning, the rest follow, and a real problem ends up buried
among them.

## 8. Exercise the release path on every merge

Run the release build in dry-run mode in CI: build every artifact and
publish nothing. A release script that only runs on release day breaks
quietly in between, and you find out on release day.

## 9. Leave nothing orphaned

Fail CI on source files that nothing references, on file types outside an
allowlist, and on stale generated files (regenerate and diff). Build the
docs in CI and fail on broken internal links; when a page moves, add a
redirect from its old address. Each of these is a part that no longer fits
with the rest, and nothing else would catch it.

## Done when

- One command runs the whole suite on a laptop and in CI, and the CI config
  only sets up the environment and calls it (rule 1).
- Main moves only to merged results that passed, and every commit on main
  keeps its own result (rule 3).
- Toolchains, dependencies, ad hoc tools, and CI actions are pinned in one
  place both a laptop and CI read, and jobs get no permissions or secrets
  by default (rule 4).
- A failing step names the command that failed and how to replay it
  locally, seed included (rule 5, rule 6).
- The release build runs in dry-run mode on every merge (rule 8).
