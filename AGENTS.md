# AGENTS.md

This repo is a collection of skills for AI coding assistants, installable
with `npx skills add Tomperez98/skills`. Two skills live here, `code` and
`docs`. Everything in this repo — new skills, edits, examples — follows
their one rules:

- **code** — bugs panic, expected failures return values.
- **docs** — lead with the reader's task, win the 10-second skim, never mislead.

## The full rules live in the branch guides

Read the matching guide before you write or edit anything here; this file
does not restate them.

- `skills/coding/code/WRITE.md` · `REFACTOR.md` · `TEST.md`
- `skills/coding/docs/` — README, API, TUTORIAL, CHANGELOG, LANDING, DOCS_MARKETING

## Skill format

- One skill per folder: `skills/<category>/<skill>/SKILL.md` plus branch
  guides, one per situation the skill handles.
- Frontmatter: `name` (lowercase, hyphenated) + `description`.
- **Keep `description` ≤ 1024 characters** (folded). pi rejects longer ones
  with "description exceeds 1024 characters". Count the folded string —
  block-scalar newlines fold to spaces — not the source lines.
- The description is the trigger. Name the situations that should fire the
  skill in the reader's vocabulary, and keep the "even if they never say X"
  cases that would otherwise miss it.
- One rule per skill, stated once up top; the branches turn it into
  procedure, applied in order.

## Working here

- To change a skill's behavior, edit its branch guide and keep the one
  rule intact.
- To add a skill, copy the shape of an existing one (README → "Adding a
  skill").
- Keep the README's skill table (name, one rule, branches) in sync.
