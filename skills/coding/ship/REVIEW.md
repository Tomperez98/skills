# Routing review by contract change

You're letting the checks decide who reviews a pull request, and whether it
can merge on green alone. This works only where behavior is written down
as an executable spec (COMPAT.md rule 3); without one, every pull request
gets a person and CI.md rule 7 covers what to check. Apply the rules in
order.

## 1. Label every pull request by what it does to the contract

Let the checks label every pull request, and let the label pick the
review:

- **Contract unchanged:** no spec or schema changed, and every affected
  spec is green against the build in both directions. Code only.
- **Additive:** new operations, or outcomes outside every closed set, and
  the last release's contract still green. One owner of the spec approves.
  A new value in a closed enum, status, or error set is breaking (accordant
  skill, BASELINE.md rule 6; COMPAT.md rule 6).
- **Breaking:** the last release's contract rejects the build. The spec's
  owners approve the declared break (COMPAT.md rule 6).
- **Baseline:** no earlier release shipped a contract, so there is nothing
  to diff against; this change records the first one. Not a stage on the
  way to *additive*, and it blocks nothing.

Put the spec and schema directories under named owners (a `CODEOWNERS`
file), so every contract change merges with a person's approval. People
decide what the contract should be; the checks decide whether the code
obeys it.

## 2. Post the contract change, not just the code diff

Post on the pull request the promises added, removed, or reworded, in
words; which side moved when spec and code change together (the old spec
judging the new build shows a behavior change, the new spec judging old
traces shows a contract change); and an exact, runnable replay of every
failure.

The promises added, removed, or reworded are the change's **own** diff
against the commit it was built on (its target branch, or the ref it was
pushed over), not against the last release: a change that touches neither
spec nor code reads *unchanged*, a promise an earlier merged change added
does not reappear here, and only a release compares against the release
before it. The compatibility verdict (the last release's contract still
accepts the build) stays against the last release.

Fail the build when a public operation has no spec, when a rule in the
spec never runs, or when a test asserts on responses itself instead of
leaving that to the spec.

## 3. Post from a job that runs none of the pull request's code

The job that checks the pull request keeps a read-only token (fork pull
requests get nothing else) and uploads its verdict as data. A workflow
triggered by that run's completion (`workflow_run` on GitHub) holds the
write token, checks out only the base, validates the verdict as untrusted
input, and applies the verdict as a machine-readable marker, not a
comment: a label to route the review, a check to gate the merge.

Apply it idempotently (the label set to the verdict with the others
removed; one check per commit), so a retry or a force-push updates the
marker instead of stacking. Apply it only if the verdict describes both
the pull request's current head and the base it was diffed against;
recompute the verdict against the actual merge base in the merge-queue
run, so a base that moved under a busy queue re-runs the marker the way a
moved head does.

GitHub runs that workflow only from the default branch: the pull request
that adds it can't exercise it, and the first real verdict lands on the
next pull request. Runs triggered by a push have no pull request, so the
job skips them.

## 4. Start with the labels as information only

Let "contract unchanged" merge on green alone after the specs have caught
real bugs: a spec that only checks `success` passes every coverage check
and judges nothing, and no check can tell.

## 5. Watch the gate's own numbers

The gate fails quietly the way a scheduled job does (MONITOR.md rule 4).
Watch the numbers behind it: the fraction of pull requests that are
additive or breaking rather than unchanged, the contract suite's flake
rate, how long the verdict takes, and how long a spec owner takes to
approve. A surface where the same API keeps changing is hot; version it or
move it behind a stable boundary, because a contract that changes
constantly defeats the point of letting most pull requests merge on green
alone (rule 4).

## Done when

- Every pull request carries one contract label, and the spec and schema
  directories have named owners (rule 1).
- The pull request shows its own promise diff and a runnable replay of
  every failure (rule 2).
- The label is applied by a job that runs none of the pull request's code,
  and only for the current head and base (rule 3).
- "Contract unchanged" merges on green alone only after the specs have
  caught real bugs (rule 4).
- The gate's numbers (hot surfaces, flake rate, verdict latency,
  owner-approval time) are watched, and a hot surface is versioned or
  moved behind a stable boundary (rule 5).
