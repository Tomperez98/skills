---
name: diagnose
description: >
  Chase something that's broken, failing, flaky, or slow down to a fix and
  a test that pins it. Invoked by name only.
disable-model-invocation: true
---

# Diagnose

Take a red signal to a fix the next change can't undo. Each step ends in a
`Done:` check; finish it before the next step starts. Everything here
follows from one rule:

> **Get a red, repeatable signal before you change anything.**

## 1. Name what is red

Say in one line what fails and where. Some failures have their own guide;
follow it, then come back for step 5:

- **An Accordant run is red** → call the Skill tool with "accordant" and
  follow its DEBUG.md.
- **CI fails but passes locally, or fails now and then** → call the Skill
  tool with "ship" and follow its CI.md (ship skill, CI.md rule 5).
- **Main went red after a merge** → call the Skill tool with "ship" and
  follow its MONITOR.md: bisect the commit range (ship skill, MONITOR.md
  rule 1).
- **A release failed partway or shipped broken** → call the Skill tool
  with "ship" and follow its PUBLISH.md, then RELEASE.md.
- **It got slow** → call the Skill tool with "code" and follow its
  PERFORMANCE.md: measure before you change anything.

Anything else is a bug in the code; carry on.

Done: one line naming the symptom in the user's words, and the route taken.

## 2. Build the loop

Write one command that goes red on this bug: a failing test, a script
against a running server, a CLI run diffed against known output. It
asserts the user's exact symptom, not "didn't crash". Make it fast and
deterministic: pin time, seed randomness, isolate the filesystem. For a bug
that shows up only sometimes, raise the rate (loop it, run in parallel, add
load) until it fails often enough to work against.

If you can't build one, stop and say so: list what you tried and ask for
access, a captured artifact, or permission to instrument.

Done: the command, run at least once, with its red output shown, secrets
redacted.

## 3. Shrink it

Cut inputs, callers, config, and steps one at a time, re-running the loop
after each cut. Keep only what the failure needs.

Done: removing any remaining element turns the loop green.

## 4. Hypothesise, then probe

Write three to five ranked hypotheses, each with the prediction that would
prove it wrong ("if X is the cause, changing Y makes it pass"). Show the
list to the user before you test it; carry on with your ranking if they're
away. Probe one hypothesis at a time, and tag every debug log with one
prefix (`[DEBUG-a4f2]`) so cleanup is one search.

Done: one hypothesis survived its probe, and the others were ruled out by
theirs.

## 5. Fix it and pin it

Turn the shrunk loop into a regression test where the bug happens, and
watch it fail before the fix: call the Skill tool with "code" and follow
its TEST.md (code skill, TEST.md rule 11). If no test can reach the bug
where it happens, that's the finding: call the Skill tool with "code" and
follow its REFACTOR.md.

Done: the test fails without the fix and passes with it, and the original
loop from step 2 is green.

## Done when

- The symptom is named and routed (step 1).
- A command that went red on this bug was run and shown (step 2).
- The cause is the one hypothesis whose prediction held (step 4).
- A regression test fails without the fix, passes with it, and no
  `[DEBUG-` tag is left in the code (step 5).

## Hand off

- **The fix is ready to ship** → tell the user to type `/release`.
- **The bug came from a design that fights its tests** → call the Skill
  tool with "code" and follow its REFACTOR.md.
