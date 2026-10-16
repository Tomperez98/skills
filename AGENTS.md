# AGENTS.md

This repo is a collection of skills for AI coding assistants, installable
with `npx skills add Tomperez98/skills`. Five skills live here, `code`,
`docs`, `ship`, `mvp`, and `accordant`, plus `ask`, a user-invoked router
over them, and `writing-skills`, which says how to write, change, and trim
them. Everything in this repo — new skills, edits, examples — follows
their one rules:

- **code** — bugs panic, expected failures return values.
- **docs** — lead with the reader's task, win the 10-second skim, never mislead.
- **ship** — keep main releasable; make every release boring — scripted,
  re-runnable, verified.
- **mvp** — get a real person to their "aha" in five minutes.
- **accordant** — write the contract once, in the spec, and let it judge
  every response.
- **writing-skills** — every line earns its place in the agent's context.

## The full rules live in the branch guides

Read the matching guide before you write or edit anything here; this file
does not restate them.

- `skills/meta/writing-skills/` — NEW, EDIT, PRUNE. Start here for any
  change to this repo's skills or this file.
- `skills/coding/code/` — WRITE, STATE, SHAPE, LOGIC, REFACTOR, TEST
- `skills/coding/docs/` — README, API, TUTORIAL, CHANGELOG, LANDING,
  DOCS_MARKETING
- `skills/coding/ship/` — CI, MONITOR, RELEASE, PUBLISH, COMPAT
- `skills/product/mvp/` — PICK, SPEC, RESEARCH, AHA, VALIDATE
- `skills/coding/accordant/` — SPEC, GENERATE, ORACLE, CONCURRENCY, ASYNC,
  FAULTS, BASELINE, TRACES, DEBUG
- `skills/meta/ask/SKILL.md` — the router; no branch guides. Add a new
  skill or guide to its map (situation → skill and guide names only).

## Skill format

- One skill per folder: `skills/<category>/<skill>/SKILL.md` plus branch
  guides, one per situation the skill handles.
- Frontmatter: `name` (lowercase, hyphenated) + `description`. A skill
  the user starts by name, like `ask`, adds `disable-model-invocation:
  true` and keeps its description to what it answers.
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
  procedure, applied in order. Each meaning lives in one file: a `SKILL.md`
  doesn't restate a guide, and a pointer holds a trigger and a link, with
  no summary of the target.
- Split a guide by the situation that triggers each rule, not by length: a
  guide the agent must read whole to use one rule gets cut, with a pointer
  to each part. Write instructions positively ("validate once at the edge"
  beats "don't re-validate"), and keep a prohibition for an irreversible
  step.
- A guide whose work has an end state closes with an unnumbered
  `## Done when`: three to five checkable items, each citing the rule it
  checks. Leave it unnumbered so rule citations don't shift. Where a guide
  produces a record or verdict, give its shape as a fenced template in the
  rule that produces it.
- A step that can't be undone (a publish, a declared break) says the agent
  stops and asks there, and says the steps before it run without asking.
- When one skill needs another, say so as an instruction (`call the Skill
  tool with "ship" and follow its CI.md`). End each `SKILL.md` with a
  `## Hand off` section naming those transitions.

## Working here

- To change a skill's behavior, edit its branch guide and keep the one
  rule intact: call the Skill tool with "writing-skills" and follow its
  EDIT.md.
- To add a skill, call the Skill tool with "writing-skills" and follow its
  NEW.md. To trim one, follow its PRUNE.md.
- Keep the README's skill table (name, one rule, branches) in sync.
- **State the scale a rule assumes.** A rule that silently breaks at a
  hundred pulls a day — one shared file every pull request edits, a full
  suite run per change, a person reviewing every merge — is a bug in the
  guide, not a caveat to leave unstated. Guidance that holds only for one
  scale names that scale, or names what changes as the repo grows.
- Run `mise run ci` before you push.

## Checks

CI and a laptop run the same tasks; the workflow only provides `mise` and
calls `mise run ci`. Node comes from the environment and the scripts use no
packages. The one other tool, rumdl, is pinned in `mise.toml` with its
checksums in `mise.lock`; `mise install` fetches it.

- `mise run check` — fast tier: every `SKILL.md` has valid frontmatter
  (`name` matches its folder, no duplicate fields, `description` within the
  1024-char limit and warned above the ~450 budget), every `SKILL.md` has a
  `## Hand off` section and every branch guide a `## Done when`, the README
  links every skill and branch guide, its `Skill` table names each skill
  and guide, and the `ask` router's map names every other skill and guide.
- `mise run lint` — fast tier: Markdown formatting and lint rules (rumdl,
  configured in `.rumdl.toml`). Prose wraps at 80 columns; code blocks are
  exempt. `mise run fmt` fixes what it reports, in place.
- `mise run links` — full tier: every internal link resolves, every cited
  rule exists ("CI.md rule 7", "code skill, WRITE.md rule 10") and is still
  the rule it meant on main, every Skill tool call (`call the Skill tool
  with "ship" and follow its CI.md`) names a skill that exists and guides
  that skill has, and no page under `skills/` is orphaned.
  Insert or remove a rule and this names every citation that now points at
  a different rule.
- `mise run contract` — a report, never a failure: what the change does to
  the contract people install and cite (skill names, guides, one rules,
  numbered rule headings, descriptions), labeled unchanged / additive /
  changed / breaking, with the promises added and removed. On CI it's in the
  job summary, and `contract-label.yml` labels the pull request
  (`contract: unchanged`, `additive`, `changed`, `breaking`). Removing or
  renaming a skill or guide is breaking: say so in the pull request.
- `mise run ci` — the contract report, then every tier in order. This is
  the gate a merge must pass.
