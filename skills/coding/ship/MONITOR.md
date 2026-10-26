# Watching main after merge

You're catching what the merge gate misses: bugs that take a long time to
surface, gradual regressions, and breakage in systems you don't control.
Pre-merge CI has to be fast, so after merge you keep checking main with
things that take longer. Apply the rules in order.

## 1. Keep testing after merge

Some tests are too slow for every pull request: a version matrix across the
runtimes you support, longer property or soak runs, concurrency and
fault-injection suites judged by the released contract (COMPAT.md rule 7), or a
full end-to-end suite. Run them on main, continuously or on a schedule, and
report results per commit so you can tell which change broke things. A
scheduled run covers every commit since the previous run: report that
commit range with its result, and when it fails, bisect the range to the
commit that broke it. Before releasing a commit, check that these runs are
green for it.

## 2. Track the numbers users would notice

Record a few key measurements on every merge to main: build time, artifact
size, performance, memory use, whatever users would feel. Measure the shipped
build. Watch the trend rather than any single run.
When a number jumps, it might be a regression or a deliberate trade-off,
and either way a person should decide which before users run into it.
Looking at these numbers belongs on the release checklist (RELEASE.md).

## 3. Re-check what you don't control

Registries, base images, external APIs, and toolchains change without your
repo changing. Run your release validation (PUBLISH.md rule 6) on a
schedule as well as after each release, so a broken download or a package
that's gone missing shows up before a user reports it.

## 4. Every failure reaches a person

A scheduled job that fails where nobody looks has taught no one anything.
Send failures to a place people watch, with a link to the run. Triage has
to be someone's job: every failure gets fixed, closed with a reason, or
assigned to someone who can act on it.

Keep it to one open record per failing job: the first failure opens a
tracking issue, later failures comment on it, and the first green run
closes it. A new alert on every run, or a red badge nobody owns, trains
people to look away.

## Done when

- The suites too slow for a pull request run on main, on a schedule or
  continuously, and report a result per commit or commit range, with a
  failing range bisected to one commit (rule 1).
- A few numbers users would notice are recorded on every merge, from the
  build you ship (rule 2).
- Release validation runs on a schedule, not only after a release (rule 3).
- A failing scheduled job opens one tracking issue, later failures comment
  on it, and the first green run closes it (rule 4).
