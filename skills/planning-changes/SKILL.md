---
name: planning-changes
description: Applies a workflow for turning a request into a finished change - clarifying intent, writing a spec, breaking work into vertical slices, building in increments that stay green, fresh-context review of risky claims, and session handoffs. Use when a request is vague or large, when asked to plan, spec, scope, or break down a feature, when ideating what to build, when implementing a change that spans several files or steps, before trusting a non-trivial conclusion or crossing a one-way door, or when pausing, compacting, or resuming work across sessions.
---

# Planning changes

This is the workflow skill: it owns the steps. The domain skills (writing-code, writing-docs, shipping-changes, building-interfaces, writing-skills) own the rules inside each step and win on conflict. These rules are language-, framework-, and tool-agnostic; let repo conventions decide mechanics.

**One rule: agree what done means, build it in slices that each leave the tree green, and doubt your own conclusions in a fresh context.** Size the ceremony to the change: a one-line fix needs no spec and no task list. Stop for approval only at a one-way door or when the user asked for a gate; every other step runs without asking.

## Pick the path
1. Intent unclear (no outcome, user, or success check stated) → clarify first.
2. Several independently testable capabilities, or a step that crosses a one-way door → write a spec.
3. More than one slice of work → write a task list.
4. Otherwise → implement directly under the increment rules below.

## Increments (every path)
- Each increment changes one logical thing and leaves the build and tests green. Never leave the tree broken between slices.
- Run the focused tests after each increment, before writing much more. Don't re-run a passing command on unchanged code.
- Keep each increment revertable on its own: a deletion and its replacement are separate steps.
- Touch only what the task needs. List unrelated problems under "Noticed, not touched" in the final report instead of fixing them.
- When reality changes the plan, update the spec or task list first, then the code.
- Disagree with the quantified downside and an alternative, then follow the user's informed decision.

## Load when the task matches
Read the whole file before starting that part of the task:
- Vague request, buzzword goals, or choosing what to build → [reference/clarifying-intent.md](reference/clarifying-intent.md)
- Writing a spec, success criteria, or a module map for a multi-part request → [reference/specs.md](reference/specs.md)
- Breaking work into tasks, ordering them, or running them in parallel → [reference/tasks.md](reference/tasks.md)
- Checking a non-trivial claim or your own change before trusting it → [reference/fresh-context-review.md](reference/fresh-context-review.md)
- Ending a session, compacting context, or resuming earlier work → [reference/handoffs.md](reference/handoffs.md)

## Before finishing
Review the work against this list. Fix each miss and re-check until the list is clean:
- [ ] Done was defined by checkable success criteria, and each was verified with a named command and its result.
- [ ] Every increment left the build and tests green.
- [ ] Nothing outside the task changed. Unrelated issues are listed under "Noticed, not touched".
- [ ] Each non-trivial claim got a fresh-context review, or the report says why not.
- [ ] The final report says what changed, how it was verified, what was left alone, and the open risks.
- [ ] Each reference file the task matched was read and applied.
