# AGENTS.md

This repo is a collection of skills for AI coding assistants, installable
with `npx skills add Tomperez98/skills`. Three skills live here, `code`,
`docs`, and `ship`. Everything in this repo — new skills, edits, examples —
follows their one rules:

- **code** — bugs panic, expected failures return values.
- **docs** — lead with the reader's task, win the 10-second skim, never mislead.
- **ship** — keep main releasable; make every release boring — scripted,
  re-runnable, verified.

## The full rules live in the branch guides

Read the matching guide before you write or edit anything here; this file
does not restate them.

- `skills/coding/code/WRITE.md` · `REFACTOR.md` · `TEST.md`
- `skills/coding/docs/` — README, API, TUTORIAL, CHANGELOG, LANDING, DOCS_MARKETING
- `skills/coding/ship/` — CI, MONITOR, RELEASE, PUBLISH

## Skill format

- One skill per folder: `skills/<category>/<skill>/SKILL.md` plus branch
  guides, one per situation the skill handles.
- Frontmatter: `name` (lowercase, hyphenated) + `description`.
- **Keep `description` short — it's a trigger, not a table of contents.**
  The branch guides carry the detail; the description only decides whether
  the skill fires. Aim for under ~450 folded characters — the 1024 ceiling
  is a hard limit, not a target (pi rejects longer with "description
  exceeds 1024 characters"). Count the folded string — block-scalar
  newlines fold to spaces — not the source lines.
- Name the situations that should fire the skill, in the reader's
  vocabulary, including the "even if they never say X" cases that would
  otherwise miss it. One trigger per branch: collapse synonyms that rename
  a single situation.
- One rule per skill, stated once up top; the branches turn it into
  procedure, applied in order.

## Working here

- To change a skill's behavior, edit its branch guide and keep the one
  rule intact.
- To add a skill, copy the shape of an existing one (README → "Adding a
  skill").
- Keep the README's skill table (name, one rule, branches) in sync.
- Run `mise run ci` before you push.

## Checks

CI and a laptop run the same tasks; the workflow only provides `mise` and
calls `mise run ci`. Node comes from the environment — the checks use no
dependencies.

- `mise run check` — fast tier: every `SKILL.md` has valid frontmatter
  (`name` matches its folder, `description` within the 1024-char limit),
  and the README links every skill and branch guide.
- `mise run links` — full tier: every internal link resolves and no page
  under `skills/` is orphaned.
- `mise run ci` — both tiers in order. This is the gate a merge must pass.
