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

In a repo with several services, a pull request runs the suites of the
services it changed and of every service downstream of them in the
dependency graph. A change to a shared schema or library changes every
service that uses it. Main and the release run everything.

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
the seed and print the exact command that replays the failure with it. Treat a flaky test as a
bug: fix it or quarantine it with an owner. Don't retry it until it passes,
because that hides real failures. A concurrency check that fails now and
then is not flaky: it's the race it exists to find, so keep it red until
the race is fixed (COMPAT.md rule 7).

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
The same goes for breaking changes: diff the schema and run the last
release's contract against the build (COMPAT.md), and fail when a break
lands without a breaking changelog entry. A pull request that changes a
contract between services also gets a reviewer whose only question is
whether N-1 and N still work side by side. Who else reviews, and whether
a pull request can merge on green alone, follows from what it does to the
contract (rule 10).

Run the compiler, type checker, and static analyzers at their strictest
settings and treat every warning as an error, so the warning count stays at
zero (code skill, WRITE.md rule 25). If CI allows one warning, the rest
follow, and a real problem ends up buried among them.

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

## 10. Route review by what the change does to the contract

When behavior is written down as an executable spec (COMPAT.md rule 3),
let the checks label every pull request, and let the label pick the
review:

- **Contract unchanged:** no spec or schema changed, and every affected
  spec is green against the build in both directions. Code only.
- **Additive:** new operations or outcomes, and the last release's
  contract still green. One owner of the spec approves.
- **Breaking:** the last release's contract rejects the build. The spec's
  owners approve, and the breaking changelog entry is present (COMPAT.md
  rule 6).

Put the spec and schema directories under named owners (a `CODEOWNERS`
file), so a contract change never merges without a person. People decide
what the contract should be; the checks decide whether the code obeys it.

Post the contract change on the pull request, not just the code diff: the
promises added, removed, or reworded, in words; which side moved when spec
and code change together (the old spec judging the new build shows a
behavior change, the new spec judging old traces shows a contract change);
and an exact, runnable replay of every failure. Fail the build when a
public operation has no spec, when a rule in the spec never runs, or when
a test asserts on responses itself instead of leaving that to the spec.

Post from a separate job that never runs the pull request's code. The job
that checks the pull request keeps a read-only token (fork pull requests
get nothing else) and uploads its verdict as data. A workflow triggered by
that run's completion (`workflow_run` on GitHub) holds the write token,
never checks out the pull request, validates the verdict as untrusted
input, and posts only if it describes the pull request's current head, so
a late run can't overwrite a newer one. GitHub runs that workflow only
from the default branch: the pull request that adds it can't exercise it,
and the first real post comes on the next pull request. Runs triggered by
a push have no pull request, so the job skips them.

Start with the labels as information only. Let "contract unchanged" merge
on green alone after the specs have caught real bugs: a spec that only
checks `success` passes every coverage check and judges nothing, and no
check can tell.

---

CI is the gate: it runs locally, it's reproducible, it's clear when it
fails, and it sends people only the decisions that need them. MONITOR.md covers what the gate is too slow to run, and PUBLISH.md
turns the dry-run build into a real release.
