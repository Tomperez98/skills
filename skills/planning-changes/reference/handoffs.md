# Handoffs and resuming

Part of the planning-changes skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- Before a session ends, or before context is compacted mid-task, write a handoff record: the approved scope, each task's status and the next task, changed files and the tree's state, verification commands with their results, open questions, and the approvals granted.
- Put the record where the user agrees: the PR description, the tracker, a file, or the response.
- A resumed session reads the record and the current tree (status and recent log) before acting. An approval from an earlier session covers only the steps the record says it covers.
- When compacting, keep the task definition, hard constraints, the live error with its command, and the file under edit. Reduce each dead end to one line ("tried X: fails because Y").
