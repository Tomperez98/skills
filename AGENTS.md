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

Read the matching guide before you write or edit anything here.

- `skills/meta/writing-skills/` — NEW, EDIT, PRUNE. Start here for any
  change to this repo's skills or this file.
- `skills/coding/code/` — WRITE, STATE, SHAPE, HTTP_API, LOGIC, PERFORMANCE,
  REFACTOR, TEST, CRASHONLY, CRASH_TESTS, DEPENDENCIES
- `skills/coding/docs/` — README, API, TUTORIAL, CHANGELOG, LANDING,
  DOCS_MARKETING
- `skills/coding/ship/` — CI, MONITOR, RELEASE, PUBLISH, COMPAT,
  ROLLOUT, REVIEW
- `skills/product/mvp/` — PICK, SPEC, RESEARCH, AHA, VALIDATE
- `skills/coding/accordant/` — SPEC, GENERATE, SUITES, COVERAGE, ORACLE,
  CONCURRENCY, ASYNC, FAULTS, BASELINE, TRACES, DEBUG
- `skills/meta/ask/SKILL.md` — the router; no branch guides.

## Skill format

To write, change, or trim a skill, call the Skill tool with
"writing-skills" and follow NEW.md, EDIT.md, or PRUNE.md. This repo adds:

- One skill per folder: `skills/<category>/<skill>/SKILL.md` plus one
  branch guide per situation.
- Frontmatter: `name` (lowercase, hyphenated, matching the folder) +
  `description`. A skill the user starts by name, like `ask`, adds
  `disable-model-invocation: true` and keeps its description to what it
  answers.
- Keep `description` under ~450 folded characters (block-scalar newlines
  fold to spaces). 1024 is a hard limit: pi rejects longer with
  "description exceeds 1024 characters".
- **State the scale a rule assumes.** A rule that silently breaks at a
  hundred pulls a day — one shared file every pull request edits, a full
  suite run per change, a person reviewing every merge — is a bug in the
  guide, not a caveat to leave unstated. Guidance that holds only for one
  scale names that scale, or names what changes as the repo grows.
- Keep the README's skill table (name, one rule, branches) and the `ask`
  router's map in sync with the skills and guides.
- Run `mise run ci` before you push.

## Checks

CI only provides `mise` and calls `mise run ci`; a laptop runs the same
tasks. Node comes from the environment; rumdl is pinned in `mise.toml` with
checksums in `mise.lock`.

- `mise run check` — fast: fails on bad frontmatter, a missing `## Hand off` or
  `## Done when`, or the README table, router map, or this file's guide list out
  of sync.
- `mise run lint` — fast: fails on Markdown format (prose wraps at 80);
  `mise run fmt` fixes it.
- `mise run links` — full: fails on a broken link, a citation that now
  points at a different rule, a bad Skill tool call, or an orphaned page.
- `mise run contract` — report only: labels the change unchanged /
  additive / changed / breaking. Removing or renaming a skill or guide is
  breaking: say so in the pull request.
- `mise run ci` — the merge gate: contract, then every tier.
