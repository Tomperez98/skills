---
name: ship
description: >
  Run CI and releases that stay boring. One rule: keep main releasable, and
  make every release scripted, re-runnable, and verified. Use when the user
  sets up, fixes, or speeds up CI, watches main for regressions, plans a
  release process or versioning scheme, publishes packages, or recovers
  from a failed release — even if they never say "DevOps" or "pipeline".
---

# Ship

Get code from a merged change into users' hands without drama, at whatever
cadence the project chooses. Everything in this skill follows from one
rule:

> **Keep main releasable; make every release boring — scripted,
> re-runnable, verified.**

## Pick a branch

Identify which situation you're in, from the user's prompt, the repo, or by
asking if the user is around:

- **"Set up / fix / speed up CI, write a workflow, flaky or slow checks"** →
  [CI.md](CI.md). The gate before merge: one entry point you can run
  locally, pinned, reproducible, quiet until it fails.
- **"Catch regressions after merge / benchmarks / long-running tests /
  dashboards / alerts"** → [MONITOR.md](MONITOR.md). Keep testing and
  measuring main after the gate, and put a person on every failure.
- **"Plan the release process / versioning / changelog / hotfix"** →
  [RELEASE.md](RELEASE.md). The human side: a written checklist, one
  source for the version, a soak, and fix-forward.
- **"Write / fix the release script, publish packages, handle secrets, a
  failed or partial release"** → [PUBLISH.md](PUBLISH.md). The machine
  side: build, publish idempotently, then check what actually shipped.

CI and MONITOR keep main releasable; RELEASE and PUBLISH make the release
boring. If the situation is ambiguous and the user isn't reachable, pick by
the file in front of you (a PR workflow → CI; a scheduled job or dashboard
→ MONITOR; a changelog or runbook → RELEASE; a publish script or release
workflow → PUBLISH) and state the assumption at the top of your work.

## The one rule

**Keep main releasable; make every release boring — scripted, re-runnable,
verified.**

- **Main is releasable.** Nothing lands on main that CI hasn't run on the
  exact merge commit, and main keeps being tested and measured after it
  lands. Any commit on main is a release candidate, so shipping means
  picking one, not preparing one.
- **Scripted.** One command builds every artifact and a flag publishes
  them. The only manual steps are the decisions: which commit, and "go".
- **Re-runnable.** Every publish step checks whether it's already done. A
  release that fails halfway gets fixed and re-run, and no version number
  is burned.
- **Verified.** After publishing, a separate job downloads what users will
  download, rebuilds it from the tag, compares the bytes, and runs it.

When releasing is this cheap, not releasing is cheap too: nobody rushes a
change to make a release, and "should we wait?" defaults to yes.

The `code` skill's rule applies to CI and release scripts too: a broken
precondition (the tag already exists, the build mode is wrong) is a bug, so
assert and stop. A registry timeout is an expected failure, so return it,
retry, or report it. CI is the gate and MONITOR watches what got through.
RELEASE decides what ships, and PUBLISH ships it and then checks the result.
