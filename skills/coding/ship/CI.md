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
Every merge waits for green.

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
(COMPAT.md rule 7). A contract check that gates every pull request is the
one check that stays out of quarantine: a flaky gate teaches people to
merge past red. Make it deterministic and replayable by construction
(COMPAT.md rule 3) and fix a flaky one now.

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
for breaking changes: diff the schema and run the last release's contract
against the build (COMPAT.md), and fail when a break lands without a breaking
changelog entry. A pull request that changes a contract between services also
gets a reviewer whose only question is whether N-1 and N still work side by
side. Who else reviews, and whether a pull request can merge on green alone,
follows from what it does to the contract (rule 10).

Run the compiler, type checker, and static analyzers at their strictest
settings and treat every warning as an error, so the warning count stays at
zero (code skill, WRITE.md rule 10). If CI allows one warning, the rest
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
- **Baseline:** no earlier release shipped a contract, so there is nothing
  to diff against; this change records the first one. Not a stage on the
  way to *additive*, and it blocks nothing.

Put the spec and schema directories under named owners (a `CODEOWNERS`
file), so a contract change never merges without a person. People decide
what the contract should be; the checks decide whether the code obeys it.

Post the contract change on the pull request, not just the code diff: the
promises added, removed, or reworded, in words; which side moved when spec
and code change together (the old spec judging the new build shows a
behavior change, the new spec judging old traces shows a contract change);
and an exact, runnable replay of every failure. The promises added,
removed, or reworded are the change's **own** diff against the commit it
was built on (its target branch, or the ref it was pushed over), not
against the last release: a change that touches neither spec nor code
reads *unchanged*, a promise an earlier merged change added does not
reappear here, and only a release compares against the release before it.
The compatibility verdict (the last release's contract still accepts the
build) stays against the last release. Fail the build when a public
operation has no spec, when a rule in the spec never runs, or when a test
asserts on responses itself instead of leaving that to the spec.

Post from a separate job that runs none of the pull request's code. The job
that checks the pull request keeps a read-only token (fork pull requests
get nothing else) and uploads its verdict as data. A workflow triggered by
that run's completion (`workflow_run` on GitHub) holds the write token,
checks out only the base, validates the verdict as untrusted
input, and applies the verdict as a machine-readable marker, not a
comment: a label to route the review, a check to gate the merge. Apply it
idempotently (the label set to the verdict with the others removed; one
check per commit), so a retry or a force-push updates the marker instead
of stacking. Apply it only if the verdict describes both the pull
request's current head and the base it was diffed against; recompute the
verdict against the actual merge base in the merge-queue run, so a base
that moved under a busy queue re-runs the marker the way a moved head
does. GitHub runs that workflow only from the default branch: the pull
request that adds it can't exercise it, and the first real verdict lands
on the next pull request. Runs triggered by a push have no pull request,
so the job skips them.

Start with the labels as information only. Let "contract unchanged" merge
on green alone after the specs have caught real bugs: a spec that only
checks `success` passes every coverage check and judges nothing, and no
check can tell.

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
- Every pull request carries a contract label, posted by a job that runs
  none of its code (rule 10).

---

CI is the gate: it runs locally, it's reproducible, it's clear when it fails,
and it sends people only the decisions that need them. MONITOR.md covers what
the gate is too slow to run, and PUBLISH.md turns the dry-run build into a real
release.
