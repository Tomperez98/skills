# Unattended runs

Part of the planning-changes skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- An unattended run is one nobody watches turn by turn: a background agent, a headless or scripted invocation, a scheduled or event-triggered job, or a batch across many files. A wrong assumption there compounds until someone reads the result.
- Before starting one, answer all five in writing, for this task: what done looks like (a spec, a goal condition, or a failing test to turn green), how it checks itself (a command that returns pass or fail), what it may touch (permission rules, sandbox, a worktree, the one branch it may push to), what stops it (a turn or spend cap), and where the result goes and who approves it (a PR, a comment, or a summary). Any answer missing: stop and ask the user.
- Make the stopping check deterministic when the harness allows it: a stop hook, CI, or a test the run must pass. A "keep going until tests pass" in the prompt is a request, not a guarantee.
- Pass in what the run needs explicitly (prompt, tools, settings) instead of relying on whatever the machine has loaded, so it behaves the same everywhere. Pre-approve only the tools it needs and refuse the rest.
- Give each parallel run its own checkout. A fresh worktree lacks ignored files and installed dependencies: copy the small ones in, and put the install command in the rules file.
- Pilot on two or three items, read the results, fix the prompt, then run the rest. Ask each item for a parseable verdict (`OK` or `FAIL`).
- The final report carries evidence: the commands run and their output, not "all tests pass". Merges, deploys, and anything else irreversible wait for a person.
