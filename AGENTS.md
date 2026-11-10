# AGENTS.md

Repo of Agent Skills (Markdown, not an app). Six skills in `skills/`: `writing-code`, `writing-docs`, `shipping-changes`, `building-interfaces`, `writing-skills` (domain rules), and `planning-changes` (the one workflow skill; it owns the steps and the domain skills win on content). Each is `SKILL.md` plus `reference/*.md`.

## Commands
- `mise run ci` is the merge gate (CI runs exactly this): `lint` → `test-scripts` → `check-skills`. Run it before finishing any change.
- `mise run fmt` auto-fixes Markdown that `mise run lint` (rumdl, version pinned in `mise.toml`) reports.
- `mise run check-skills` runs `node scripts/check_skills.mjs --strict`; warnings fail too.
- One test by name: `node --test --test-name-pattern='<name>' scripts/check_skills.test.mjs`.
- `scripts/` is Node built-ins only (no `package.json`, no npm install); Node is pinned in `mise.toml`. Do not add dependencies. Checks are pure functions of text, and only the `load*`, `syntaxProblem`, and `main` edges touch disk.
- Each rule needs a failing test next to the clean `GOOD` baseline in `scripts/check_skills.test.mjs`.

## Editing skills
- `skills/writing-skills/SKILL.md` is the rulebook for every skill here, including itself. The checker enforces the mechanical rules: frontmatter limits, `SKILL.md` under 500 lines (warns at 400), links, reference-file TOC over 100 lines, no stale dates, forward-slash paths.
- Link every new `reference/*.md` directly from its `SKILL.md`, with a stated trigger ("Writing tests → read `reference/tests.md`"). A bare "see also" fails the checker.
- Skill directory names must match the `name:` frontmatter. Use a gerund for the new skill name.
- Terse style is intentional: `.rumdl.toml` disables MD013, MD022, MD032, and MD040. Don't wrap long lines or add blank lines after headings and lead-ins to satisfy a linter.

## Evals
- Each skill needs `evals/<skill-name>.json`. The checker fails on a missing file, or an orphan file that matches no skill.
- A scenario has `skills` (list), `query`, `files`, and `expected_behavior` (list of strings). Each skill needs at least 3 scenarios.
- At least one `expected_behavior` per skill must name a reference file by its relative path (`reference/tests.md`). Otherwise the checker raises `evals-navigation`.
- `files` entries are relative to `evals/` and must exist, e.g. `fixtures/tryagain`. That fixture is a small Python package used by the `shipping-changes` evals.
- When you add or rename a reference file, update the evals that mention it.
