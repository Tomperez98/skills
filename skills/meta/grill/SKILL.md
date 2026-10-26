---
name: grill
description: >
  Interview the user until a plan, idea, design, or architecture has no
  open decision.
  Use when the user wants a plan stress-tested or a decision made with
  them, says "grill me", or another skill hands over a decision that is
  the user's to make.
---

# Grill

Reach a shared understanding with the user before anyone acts on it.
Everything here follows from one rule:

> **Settle every decision with the user; look up every fact yourself.**

## Ask in rounds

1. **Map the decisions as a tree.** Each decision opens the ones that
   depend on it. The **frontier** is every decision whose prerequisites are
   settled: what you can ask now without guessing an answer you haven't
   heard.
2. **Look up the facts first.** A question the repo, the docs, or a tool
   can answer is yours: send a sub-agent and keep going. Only the
   questions downstream of a running lookup wait for it.
3. **Ask the whole frontier in one round**, numbered, each with your
   recommended answer, worded so "yes" accepts it:

   ```text
   Q1 · <title>: <the question, with the options>
   → <your recommended answer>

   Q2 · <title>: ...
   → ...
   ```

   A question that depends on another one still open this round waits for
   the next round.
4. **Recompute the frontier** from the answers, and ask the next round.

Done: the frontier is empty, and the user confirmed the summary of every
decision.

## Done when

- Every decision in the tree has the user's answer, and none was assumed
  (step 4).
- Every question asked was a decision; every fact was looked up (step 2).
- The user confirmed the summary before anything was built or changed.

## Hand off

- **The settled plan is ready to build** → tell the user to type
  `/implement`.
- **The settled plan is an idea to build** → call the Skill tool with "mvp"
  and follow its SPEC.md.
- **The settled plan is an interface or module structure** → call the Skill
  tool with "code" and follow its SHAPE.md; an HTTP API → its HTTP_API.md.
- **The settled plan is a system to model** → call the Skill tool with
  "accordant" and follow its SPEC.md.
- **The settled plan is a release or rollout scheme** → call the Skill tool
  with "ship" and follow its RELEASE.md or ROLLOUT.md.
- **The settled plan changes a skill** → call the Skill tool with
  "writing-skills" and follow its EDIT.md.
