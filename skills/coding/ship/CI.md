# Continuous integration

You're setting up, fixing, or speeding up the checks that gate a merge. CI
is what keeps main releasable, and it can only do that if everyone can run
it, it runs the same way every time, and a failure points at its cause.
Apply the rules in order.

## 1. CI is a program in the repo, not YAML

Put the whole check suite behind one command that runs the same on a
laptop and on a runner (`./ci`, `make ci`, `<build-tool> ci`). The workflow
file only installs the pinned toolchain and calls that command. Logic that
lives in YAML can only be debugged by pushing commits.

```yaml
# The workflow is glue: fetch the pinned toolchain, run the entry point.
- run: ./scripts/install-toolchain.sh
- run: ./ci test
```

Write the orchestration in the project's own language where you can, not
in shell. Shell doesn't run the same on every OS, it's a second language
for the team, and nobody tests it. Collect CI, release, changelog, and
benchmark scripts as subcommands of one tool, so there's one thing to build
and one language to read.

## 2. Tier checks by cost and select them by name

Split the suite into named modes: a fast `smoke` (format, compile, lint), a
`test` mode (unit tests, short fuzz or property runs), one mode per
subsystem or client, and `all`. With no arguments you get a default that
finishes locally in minutes. Runners pass a mode to fan the suite out
across machines.

```
ci              → smoke + test          (what a developer runs)
ci smoke        → fmt, check, lint      (seconds)
ci client-java  → one client's suite    (one runner each)
ci all          → everything, including slow suites
ci typo         → fails: "unknown mode 'typo'"
```

An unknown mode fails. A typo that silently runs nothing looks exactly
like a green build.

## 3. Gate the merge commit, not the branch

Use a merge queue (or an equivalent that tests the merge result): CI runs
on the result of merging the change into current main, and main only moves
to commits that passed. Testing the branch alone proves nothing about the
combination, and with the queue doing that work, authors don't need to keep
rebasing to stay current. If a change could break compatibility between
versions (anything that makes you think about `v` and `v+1`), add a second
reviewer whose only job is to look for upgrade bugs.

## 4. Pin everything CI runs

A check that passed yesterday should pass today on the same commit. Pin
each input CI runs, and change a pin in its own diff (DEPENDENCIES.md).

- **Toolchain:** install it from a script in the repo that carries the
  exact version and checksum for each platform. Key the cache on the hash
  of that script.
- **Third-party CI steps:** reference them by an immutable commit SHA,
  with the version in a comment. A tag can move, and a SHA can't.
- **Permissions:** grant nothing by default. Each job that needs write
  access asks for exactly that.

```yaml
permissions: {}
steps:
  - uses: some-org/checkout@<40-char-sha> # v6.0.2
  - uses: some-org/cache@<40-char-sha>    # v5.0.5
    with:
      key: ${{ runner.os }}-${{ hashFiles('scripts/install-toolchain.sh') }}
```

## 5. Seed randomness from the commit

Fuzzers, property tests, and simulators find the bugs worth finding, but a
random failure you can't replay is useless. Derive the seed from the commit
hash and print the replay command on failure, so a red run replays locally
with one command. Same commit, same seed, same failure. Something you can't
make deterministic isn't a test yet, so fix it or quarantine it. Don't
retry it until it goes green.

## 6. Quiet on success, loud on failure

Hide the output of steps that pass, and on failure show all of it. When
verbose test logs flood the output, the one failing line gets lost in
megabytes. Keep each command to a few log lines, so the failing command can
be copied straight into a terminal. Give each heavy step an explicit memory
limit and timeout, so running out of either fails that named step instead
of killing the runner and looking like flakiness.

## 7. Make CI enforce what reviewers forget

Anything a reviewer has to remember to check should be a test instead. Run
a lint pass as an ordinary test that fails the build on:

- formatting, long lines, trailing whitespace, dead files and declarations;
- banned APIs, with the replacement named in the error
  (`fetch() is banned, use http.request()`);
- leftover `FIXME` markers or debug prints. Let the team use `FIXME` to
  mean "fix before merge", and have CI hold them to it;
- generated files that are stale: regenerate them in CI and diff against
  what's committed.

## 8. Exercise the release path on every merge

Run the release build in dry-run mode in CI: build every artifact with a
placeholder version, publish nothing. A release script that only runs on
release day breaks quietly in between, and you find out on release day.
CI covers merges. What happens to main after merge is in MONITOR.md.

---

CI is the gate that keeps main releasable. It's code in the repo, it's
pinned so it's reproducible, and it's seeded so failures replay. MONITOR.md
covers what the gate can't afford to run, and PUBLISH.md reuses the same
entry-point style for the release itself.
