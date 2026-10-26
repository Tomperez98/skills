---
name: implement
description: >
  Build a settled plan one vertical slice at a time: a failing test, the
  code that passes it, a cleanup, a commit. Invoked by name only.
disable-model-invocation: true
---

# Implement

Take a plan with no open decision to working, committed code. Each step
loads the skill that owns its rules and ends in a `Done:` check; finish it
before the next step starts. Everything here follows from one rule:

> **One thin slice at a time: watch its test fail, make it pass, commit.**

## 1. Settle the plan

Read the plan the user names: an mvp SPEC.md paragraph, a grill summary, an
issue, or the conversation. If it still hangs on a decision only the user
can make, call the Skill tool with "grill" and come back with its summary.
If it shapes a module or an interface, call the Skill tool with "code" and
follow its SHAPE.md before slicing; a stateful API whose call order matters
goes to accordant SPEC.md first.

Done: the plan in a few lines, with no open decision.

## 2. Cut vertical slices

Split the plan into slices that each run end to end, through every layer
the finished feature touches, so each one is a behavior a user or caller
could see. The first slice is the thinnest path that works at all; later
slices widen it. A slice that only adds a layer ("the schema", "the
handler") is not a slice: fold it into the first behavior that needs it.
Show the list to the user; carry on with it if they're away.

Done: numbered slices, each naming the behavior it adds and the test that
will prove it.

## 3. Red: write the slice's test

Call the Skill tool with "code" and follow its TEST.md. Test the slice's
behavior through its public interface, not its internals, and run it. It
must fail, and for the reason the slice names, not an import error or a
typo: a test you never saw red proves nothing (code skill, TEST.md rule
11).

Done: the test's red output shown, failing on the missing behavior.

## 4. Green: make it pass

Call the Skill tool with "code" and follow its WRITE.md. Write the least
code that turns the test green, with the error handling WRITE.md asks for,
and nothing the next slice needs. A failure that isn't this slice's test
going green is a new red: tell the user to type `/diagnose` if it isn't
obvious.

Done: the slice's test and the full suite pass.

## 5. Clean up

Call the Skill tool with "code" and follow its SHAPE.md; for code the
slice made hard to change, its REFACTOR.md. Change structure only, never
behavior, and rerun the suite after each change.

Done: the suite is green, and the slice adds no duplication or interface
the plan didn't call for.

## 6. Commit the slice

Commit the slice with the repo's message convention, test and code
together. Then go back to step 3 with the next slice.

Done: one commit per slice, and every slice from step 2 is committed.

## Done when

- The plan had no open decision before the first slice (step 1).
- Every slice ran end to end and named its test (step 2).
- Every test was seen failing on the missing behavior before its code
  existed (step 3).
- Each slice is one commit with a green suite (steps 4 to 6).

## Hand off

- **Every slice is in** → tell the user to type `/review`.
- **Reviewed and merged** → tell the user to type `/release`.
- **A red that isn't the slice's test** → tell the user to type
  `/diagnose`.
