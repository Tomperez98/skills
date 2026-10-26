---
name: writing-skills
description: >
  Write documents an agent reads: a skill, its branch guides, an AGENTS.md
  or CLAUDE.md. One rule: every line earns its place in the agent's
  context. Use when the user creates, edits, trims, or reviews a skill or an
  agent instruction file — even if they never say "prompt" or "context".
---

# Writing skills

Write a skill so the agent loads the right words at the right time and
follows them to a checkable end. Everything in this skill follows from one
rule:

> **Every line earns its place in the agent's context.**

A line earns its place when it does one of three things:

- **Changes what the agent does.** An instruction the agent follows without
  being told is a no-op, and a fact the agent can find by looking
  (`--help`, the config file, the script) is a cache that goes stale.
- **Says when to look.** A pointer names the material and the condition for
  reading it. The wording decides whether the agent reads it.
- **Says when to stop.** A step ends in a check the agent can run. A vague
  end invites stopping early.

Two costs pay for every line. *Context load* is the tokens and attention an
always-loaded line takes from every task. *Cognitive load* is the effort a
person spends to know which document exists and when to use it. A skill is
good when both stay low and the agent still gets the right behavior.

## Pick a branch

Identify the situation from the user's prompt or the files in front of you.
When it is ambiguous and the user isn't reachable, take the default in
parentheses and state the assumption at the top.

- **Create a skill, a branch guide, or an instruction file** (default for
  "write me a skill") → [NEW.md](NEW.md).
- **Change a skill's behavior** (default for "make it do X instead") →
  [EDIT.md](EDIT.md).
- **Trim, audit, or review a skill or instruction file** (default for "it's
  too long" or "it keeps ignoring X") → [PRUNE.md](PRUNE.md).

Where the repo has its own skill format and checks (an `AGENTS.md`, a
validation script), those decide the mechanics. They stay inside the one
rule.

## Hand off

When the task crosses into another skill's ground, load it with the Skill
tool rather than carrying on from memory:

- **Writing for people** (a README, a tutorial) rather than for an agent →
  when a `docs` skill is installed, call the Skill tool with "docs" and
  follow its guide for the artifact.
- **Gating the skill collection on checks in CI** → when a `ship` skill is
  installed, call the Skill tool with "ship" and follow CI.md.
