# Creating a skill

You're writing a new skill, a branch guide inside one, or an instruction
file (`AGENTS.md`, `CLAUDE.md`). The goal is a document the agent loads only
when it applies and follows to a checkable end. Apply the rules in order.

## 1. Pick the packaging by who must reach it

Choose the form from who has to trigger the material.

| Reader | Form | Context cost |
|--------|------|--------------|
| Every task in the project | Instruction file (`AGENTS.md`, `CLAUDE.md`, or the tool's equivalent) | Always loaded |
| The agent, or another skill, on a situation | Model-invoked skill | The description, always loaded |
| Only a person who types its name | User-invoked skill (`disable-model-invocation: true`) | None |
| A guide inside a skill | Branch guide behind a pointer | None until read |

Keep an always-loaded file to what every task needs. A situation that fires
rarely belongs in a skill; a skill that only a person starts by hand belongs
in the user-invoked form. Reference that two user-invoked skills share goes
in a plain file both point to, because neither can trigger the other.

A sequence a person starts on purpose (cut a release, chase a bug) is a
user-invoked **workflow**: a `SKILL.md` with no branch guides whose steps
each call the Skill tool with the skill that owns the rules. The workflow
owns only the order and the check between steps; the guides keep the rules.

At the scale of a handful of skills, a model-invoked description per skill
is cheap. At dozens, each description is a standing tax, so make the rarely
used ones user-invoked and add a router (rule 7).

## 2. State one rule, once, at the top

A skill is one sentence the agent can test its output against, stated once
in the `SKILL.md`:

> **<The rule as a sentence an output either obeys or doesn't.>**

Write the rule as a test: either the output obeys it or it doesn't. If you
need an "and" between two unrelated ideas, you have two skills. Branches turn
the rule into procedure; they never restate it.

## 3. Write the description as a trigger

The description decides whether the skill fires, and it is always loaded.

- Name the situations in the reader's vocabulary: "creates, edits, or trims
  a skill", not "skill lifecycle management".
- Add the "even if they never say X" cases that would otherwise miss.
- Give each branch one trigger and collapse synonyms that name one situation.
- Keep it to a few lines, well under any length limit the tool or project
  states. The detail goes in the branch guides.

```yaml
name: invoices
description: >
  Reconcile invoices against payments. One rule: every payment matches
  exactly one invoice line. Use when the user imports a bank statement,
  matches payments, or asks why a balance disagrees — even if they never
  say "reconciliation".
```

## 4. Split by situation, one guide per branch

Cut a branch guide when the situations differ in what the agent does next,
not when the file gets long. Each `SKILL.md` carries a `## Pick a branch`
list of pointers, and each guide handles one situation start to finish.

Split a guide further only when the cut earns the load it adds: a different
situation, a different sequence, or a separate skill invocation.

## 5. Write every pointer as a trigger plus a target

A pointer is a reference in context that names material outside it and the
condition for reading it.

- Front-load the key word of the situation: **"Read config or env vars"** →
  `STATE.md`.
- Give each distinct situation its own pointer, and each pointer one
  trigger.
- Leave out what the target says. The target is the source of truth for its
  content, and a summary next to the pointer drifts from it.
- When the agent misses a must-have target, sharpen the pointer's wording
  before you inline the material.

## 6. Give every step a completion criterion

Each step, and each guide, ends in something the agent can check.

- Make the criterion checkable ("every public function has a test per
  documented failure"), and exhaustive where the work is a sweep ("every
  `catch`, every config read").
- In a sequence, where each step builds on the last one's output, end each
  step with a `Done:` line the agent checks before it moves on, so an
  unfinished step can't pass for finished.
- Close a guide with an unnumbered `## Done when` of three to five items,
  each citing the rule it checks.
- Where a guide produces a record or verdict, give its shape as a fenced
  template in the rule that produces it.
- A step that can't be undone (a publish, a declared break) says the agent
  stops and asks there, and says the steps before it run without asking.

## 7. Add a router when the skills outnumber what a person remembers

A user-invoked router names the other skills and when to use each, so the
person remembers one name. A router can only point; it can't fire a
model-invoked skill from its description. Keep its map to situation → skill
and guide names, and have it read the guide before it describes it, so the
guide stays the one source of truth for what it does. When you create a
skill or guide in a collection with a router, add it to the router's map.

## 8. Say how one skill hands off to another

When a skill needs another, write it as an instruction: `call the Skill
tool with "ship" and follow its CI.md`. A citation that only explains why
(`CI.md rule 7`) stays a reference. End each `SKILL.md` with a `## Hand off`
section listing the transitions.

## Done when

- The packaging matches who must reach the material (rule 1).
- The `SKILL.md` states one rule once, as a testable sentence (rule 2).
- The description names each situation once, in the reader's words, within
  budget (rule 3).
- Every branch guide handles one situation, and each pointer is a trigger
  plus a target with no summary (rules 4 and 5).
- Every guide ends in a `## Done when` of checkable items, and the checks
  the repo defines pass (rule 6).
