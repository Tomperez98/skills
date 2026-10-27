---
name: ship
description: >
  Use when the user sets up, fixes, or speeds up CI, publishes a package or
  library, plans a release process or versioning scheme, asks whether a
  change is breaking, recovers from a failed release, or watches main for
  regressions — even if they never say "DevOps", "pipeline", or "release".
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
- **"Catch regressions after merge / scheduled checks / alerts"** →
  [MONITOR.md](MONITOR.md).
- **"Plan the release process / versioning / changelog / bad release"** →
  [RELEASE.md](RELEASE.md).
- **"Write / fix the release script, publish packages, handle secrets"** →
  [PUBLISH.md](PUBLISH.md).
- **"Is this a breaking change / backward compatibility / API diff"** →
  [COMPAT.md](COMPAT.md).
- **"Several services / deploy order / old and new versions side by side"**
  → [ROLLOUT.md](ROLLOUT.md).
- **"Who reviews this / merge on green / contract labels"** →
  [REVIEW.md](REVIEW.md).

When the situation is ambiguous and the user isn't reachable, pick by the
file in front of you (a PR workflow → CI; a scheduled job or dashboard →
MONITOR; a changelog or release checklist → RELEASE; a publish script →
PUBLISH; a schema, API diff, or compat baseline → COMPAT; a deploy order or
version window → ROLLOUT; a contract-label workflow or `CODEOWNERS` →
REVIEW) and state the assumption at the top.

## What the rule requires

- **Releasable:** any commit on main could ship as it is.
- **Scripted:** the only manual parts are the decisions, which commit and
  "go".
- **Re-runnable:** a release that fails halfway runs again without burning
  a version.
- **Verified:** the check reads what users get, not what you meant to ship.

The `code` skill's rule applies to pipelines too. A broken precondition
(the version already holds different bytes, the tests didn't run) is a
bug: stop loudly.
A network or registry failure is expected: retry it or report it.

## Terms

Use these words exactly, in the guides and in what you write for the user.

- **Contract:** what users rely on, in two layers: **shape** (schema,
  signatures) and **behavior** (what the system does with a well-formed
  call). A **promise** is one behavior rule, written as
  `"<situation> → <outcome>"`. _Avoid_: API, when you mean behavior too.
- **Break:** a change to the contract that a caller of the last release can
  notice. **Declared** means it has a breaking changelog entry and a major
  bump; anything else is undeclared, and fails the build. _Avoid_:
  regression (that's a bug), "backward-incompatible" without saying which.
- **N-1, N:** the last release and the one being built. The **window** is
  the range of versions that must work together while a deploy rolls out.
- **Frozen commit:** the SHA, resolved from remote main, that a release
  ships and nothing else. _Avoid_: release branch, "latest main".
- **One-way door:** a step that can't be undone, such as a publish or a
  declared break; the agent stops and asks there. Every other step is a
  **two-way door** and runs without asking.

## Hand off

When the task crosses into another skill's ground, load it with the Skill
tool rather than carrying on from memory:

- **Writing the behavior spec COMPAT.md checks** → call the Skill tool with
  "accordant" and follow SPEC.md, then its BASELINE.md.
- **Writing the changelog entry a release or a break needs** → call the
  Skill tool with "docs" and follow CHANGELOG.md.
- **Fixing the code a failing gate points at** → call the Skill tool with
  "code" and follow the branch that fits.
