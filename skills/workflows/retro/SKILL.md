---
name: retro
description: >
  Look back over a session and propose changes to the skills, instruction
  files, and checks so the next session goes better. Invoked by name only.
disable-model-invocation: true
---

# Retro

Turn what went wrong in a session into a change to the agent's environment,
not the code. Each step ends in a `Done:` check; finish it before the next
step starts. Everything here follows from one rule:

> **Fix the mistake where the next agent will meet it: a check if a script
> can see it, a guide line if it takes judgement.**

## 1. Collect the moments

Read the session the user names (the current one by default; a past one
from its log). List each moment the agent went wrong or slow: the user
corrected it, it retried a tool, it read the wrong file, it stopped early,
it asked for a fact it could have looked up.

Done: a list of moments, each quoting what happened.

## 2. Find the layer

Call the Skill tool with "writing-skills" and follow its EDIT.md: each
moment traces to one cause (EDIT.md rule 1). Two
more causes sit outside the skills: information the agent couldn't reach
(a log, a dashboard, a read-only credential), and an expensive tool call
a cheaper one would answer.

Done: every moment names one layer.

## 3. Pick check or guide

A mistake a script can see (a fixed pattern, a missing section, a wrong
path or citation) becomes a check: read the repo's existing checks first,
since a check that exists but isn't wired into CI is the finding. To add
one, call the Skill tool with "ship" and follow its CI.md (ship skill,
CI.md rule 7). A mistake that takes judgement becomes a guide edit
through writing-skills EDIT.md. Lines in an always-loaded file that changed
nothing this session are candidates for writing-skills PRUNE.md rule 3.

Done: each moment has one proposed change, a check or a guide edit.

## 4. Report, most severe first

```text
<severity>  <moment, one line>
            Layer:  <description | pointer | completion | rule | access | tool>
            Change: <the check or the guide line, and the file>
```

Apply only the changes the user picks.

Done: the user has the list and picked what to apply.

## Done when

- Every moment from the session is on the list, quoted (step 1).
- Each one names one layer and one change (steps 2 and 3).
- Mechanical mistakes became checks, not guide lines (step 3).
- Nothing was applied without the user picking it (step 4).

## Hand off

- **A picked change edits a skill** → call the Skill tool with
  "writing-skills" and follow its EDIT.md.
- **A picked change adds a check** → call the Skill tool with "ship" and
  follow its CI.md.
