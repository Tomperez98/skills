# Rules files (AGENTS.md, CLAUDE.md)

Part of the writing-skills skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- A rules file loads in every session, so it costs tokens on every task. It holds only what the model can't infer from the repo: exact commands, boundaries, and project facts that differ from the default.
- Commands are exact and copy-paste: build, the full gate CI runs, lint and its auto-fix, and how to run one test by name.
- State boundaries in three groups: always, ask first, never. Give the reason for any rule that isn't obvious ("no npm install: scripts/ uses Node built-ins only").
- Don't restate what a linter or check already enforces; name the check instead.
- Keep one rules file as the source of truth. Other tools' files point at it or are generated from it.
- Put rules that apply to one directory in a rules file in that directory, when the tool loads nested files.
- Revise from observed failures: add a rule when an agent gets the same thing wrong twice, and delete a rule the agent follows without being told.
