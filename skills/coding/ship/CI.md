# Continuous integration

You're setting up, fixing, or speeding up the checks that gate a merge. CI
keeps main releasable only if everyone can run it, it gives the same answer
every time, and a failure points at its cause. Apply the rules in order.

## 1. CI is code in the repo, runnable locally

Put the whole check suite behind one command that behaves the same on a
laptop and on a CI runner (`make ci`, `./ci`, `npm run ci`). The CI config
only sets up the environment and calls that command. Logic that lives only
in CI config can only be debugged by pushing commits.

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

## 3. Test what will land, not just the branch

A branch that passes on its own can still break main once merged. Test the
result of merging into current main, with a merge queue or by requiring the
branch to be up to date, and only let main move to commits that passed.
Nobody merges past a red check.

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
  copy, and it drifts.
- **Least privilege:** jobs get no permissions or secrets by default. Each
  job asks for exactly what it needs.
- **Cache only what's derived from pinned inputs,** keyed on the files that
  pin them, so a cache can never change what a run does.

## 5. Every failure can be reproduced

A failure you can't reproduce is noise. When a test uses randomness, log
the seed and print the command that replays it. Treat a flaky test as a
bug: fix it or quarantine it with an owner. Don't retry it until it passes,
because that hides real failures.

## 6. Make failures easy to read

Keep passing steps quiet and give failing ones full output. Point at the
step that failed, the command that failed, and how to run it locally. Give
heavy steps a timeout and a resource limit, so a hang or running out of
memory fails a named step instead of looking like the infrastructure
flaking.

## 7. Automate the review checklist

If reviewers keep catching the same kind of problem, make it a check:
formatting, lint rules, banned APIs (with the replacement in the error
message), leftover debug code, and generated files that weren't
regenerated. Reviewers should be spending their time on design.

## 8. Exercise the release path on every merge

Run the release build in dry-run mode in CI: build every artifact and
publish nothing. A release script that only runs on release day breaks
quietly in between, and you find out on release day.

---

CI is the gate: it runs locally, it's reproducible, and it's clear when it
fails. MONITOR.md covers what the gate is too slow to run, and PUBLISH.md
turns the dry-run build into a real release.
