---
name: mvp
description: >
  Turn an idea into a validated MVP. One rule: get a real person to their
  "aha" in five minutes. Use when the user has a vague product idea, wants
  to pick or shape an idea, check whether the premise is real, spec the core
  use case, cut scope, find the five-minute value moment, or test an MVP on a
  real person — even if they never say "MVP", "product-market fit", or
  "aha".
---

# MVP

Turn a vague idea into something a real person actually gets value from, and
do it before you build the whole thing. Everything in this skill follows from
one rule:

> **Get a real person to their "aha" in five minutes.**

## Pick a branch

Identify which stage you're at, from the user's prompt or by asking if the
user is around:

- **"I need an idea / what should I build?"** → [PICK.md](PICK.md).
- **"Is this premise actually real? Research it before I build."** →
  [RESEARCH.md](RESEARCH.md).
- **"I have an idea — shape it / spec it."** → [SPEC.md](SPEC.md).
- **"What's the core use case? Cut the feature list."** → [AHA.md](AHA.md).
- **"Is this any good? Will people use it?"** → [VALIDATE.md](VALIDATE.md).

The four core branches run in order — pick, spec, focus, validate — with
RESEARCH as a side-step between pick and spec when the premise is a hunch
rather than evidence.
When the stage is ambiguous and the user isn't reachable, default to the one
the prompt names (a blank slate → PICK; a feature pile or a "trim it" ask →
AHA; a built thing or a "will anyone use this" ask → VALIDATE) and state the
assumption at the top.

## What the rule requires

- **A real person** is anyone who isn't you; your own excitement is not
  evidence.
- **An "aha", not a feature.** The aha is the instant the user gets what
  the thing is for and feels the payoff. Features are the means; the aha is
  the end. If you can't name the aha, you don't have an MVP yet.
- **Five minutes** is the attention a new app gets before the user leaves.

## Hand off

When VALIDATE says build it, the work leaves this skill. Load the next one
with the Skill tool rather than carrying on from memory:

- **Building the core use case** → call the Skill tool with "code" and
  follow WRITE.md. The brief is the paragraph from SPEC.md.
- **The README or landing page the tester reads first** → call the Skill
  tool with "docs" and follow README.md or LANDING.md.
