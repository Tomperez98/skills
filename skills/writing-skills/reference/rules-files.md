# Rules files (AGENTS.md, CLAUDE.md)

Part of the writing-skills skill. The core rules in [SKILL.md](../SKILL.md) still apply.

- A rules file loads in every session, so it costs tokens on every task. It holds only what the model can't infer from the repo: exact commands, boundaries, and project facts that differ from the default. Test each line: could the agent find this by reading the code, and would it go and look? Two yeses: cut it.
- Commands are exact and copy-paste: build, the full gate CI runs, lint and its auto-fix, and how to run one test by name.
- State boundaries in three groups: always, ask first, never. Give the reason for any rule that isn't obvious ("no npm install: scripts/ uses Node built-ins only").
- Name what the code can't tell: a pattern that's everywhere but new code must not copy, a directory that looks dead but is live, decisions made outside the repo (which error helper, how deploys work), and anything corrected twice.
- Don't restate what a linter or check already enforces; name the check instead.
- A rules file is guidance the model weighs, not a guarantee. A rule that must hold every time (never read `.env`, never edit generated code, always run the formatter) goes in the harness: a deny rule, a hook, or the sandbox. Preferences with exceptions stay as text. If the harness can't enforce it, say so to the user.
- When a rule keeps being missed, don't add IMPORTANT or capitals; emphasis makes the model over-apply it. Shorten the file so the line isn't lost, or move the rule into enforcement.
- Keep one rules file as the source of truth. Other tools' files point at it or are generated from it.
- Put rules that apply to one directory in a rules file in that directory, or a path-scoped rule, when the tool supports either.
- Move long procedures (release, incident runbook) out into a skill, which loads only when triggered. Make a skill with side effects user-invoked only, when the tool supports that.
- Revise from observed failures: add a rule when an agent gets the same thing wrong twice, and delete a rule the agent follows without being told.
