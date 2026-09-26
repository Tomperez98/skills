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

- **"Set up / fix / speed up CI, flaky or slow checks"** → [CI.md](CI.md).
  The gate before merge: runnable locally, reproducible, actionable when
  it fails.
- **"Catch regressions after merge / scheduled checks / alerts"** →
  [MONITOR.md](MONITOR.md). Keep testing and measuring main after the
  gate, and put a person on every failure.
- **"Plan the release process / versioning / changelog / bad release"** →
  [RELEASE.md](RELEASE.md). The human side: what ships, what it's called,
  and what happens when it's wrong.
- **"Write / fix the release script, publish packages, handle secrets"** →
  [PUBLISH.md](PUBLISH.md). The machine side: build, publish safely, then
  check what actually shipped.

CI and MONITOR keep main releasable; RELEASE and PUBLISH make the release
boring. If the situation is ambiguous and the user isn't reachable, pick by
the file in front of you (a PR workflow → CI; a scheduled job or dashboard
→ MONITOR; a changelog or release checklist → RELEASE; a publish script →
PUBLISH) and state the assumption at the top of your work.

## The one rule

**Keep main releasable; make every release boring — scripted, re-runnable,
verified.**

- **Main is releasable.** Nothing lands on main without passing CI, and
  main keeps being tested after it lands. Any commit on main could be
  released, so shipping means picking a commit, not preparing one.
- **Scripted.** Building and publishing are commands, not a sequence of
  manual steps. The only manual parts are the decisions: which commit, and
  "go".
- **Re-runnable.** A release that fails halfway can be fixed and run again
  without breaking anything or burning a version.
- **Verified.** After publishing, check what users will actually get, not
  what you meant to ship.

The `code` skill's rule applies to pipelines too. A broken precondition
(the version already holds different bytes, the tests didn't run) is a
bug: stop loudly.
A network or registry failure is expected: retry it or report it.
