# AGENTS.md

This repo is a collection of skills for AI coding assistants, installable with
`npx skills add Tomperez98/skills`. Four skills live here, `code`, `docs`,
`ship`, and `accordant`, each a content rule for one kind of work. The
process loop — brainstorming, planning, test-driven development, review — is
[Superpowers](https://github.com/obra/superpowers); these skills supply the
rules its steps follow. Everything here — new skills, edits, examples —
follows their one rule:

- **code** — bugs panic, expected failures return values.
- **docs** — lead with the reader's task, win the 10-second skim, never mislead.
- **ship** — keep main releasable; make every release boring — scripted,
  re-runnable, verified.
- **accordant** — write the contract once, in the spec, and let it judge
  every response.

## The full rules live in the branch guides

Read the matching guide before you write or edit anything here.

- `skills/coding/code/` — WRITE, STATE, SHAPE, HTTP_API, LOGIC, PERFORMANCE,
  REFACTOR, TEST, CRASHONLY, CRASH_TESTS, DEPENDENCIES
- `skills/coding/docs/` — README, API, TUTORIAL, CHANGELOG, LANDING,
  DOCS_MARKETING
- `skills/coding/ship/` — CI, MONITOR, RELEASE, PUBLISH, COMPAT,
  ROLLOUT, REVIEW
- `skills/coding/accordant/` — SPEC, GENERATE, SUITES, COVERAGE, ORACLE,
  CONCURRENCY, ASYNC, FAULTS, BASELINE, TRACES, DEBUG

## Skill format

To write, change, or trim a skill, invoke Superpowers' writing-skills
skill. This repo adds:

- One skill per folder: `skills/<category>/<skill>/SKILL.md` plus one
  branch guide per situation. A branch guide earns its own file only when
  the situation has enough numbered rules to fill a page; a one-rule
  situation stays inline in `SKILL.md`.
- Frontmatter: `name` (lowercase, hyphenated, matching the folder) +
  `description`. The `description` names only when to use the skill —
  trigger phrases and symptoms, starting with "Use when" — never the one
  rule or a summary of the procedure; the one rule lives in the SKILL.md
  intro blockquote.
- Keep `description` under ~450 folded characters (block-scalar newlines
  fold to spaces). 1024 is a hard limit: pi rejects longer with
  "description exceeds 1024 characters".
- **State the scale a rule assumes.** A rule that silently breaks at a
  hundred pulls a day — one shared file every pull request edits, a full
  suite run per change, a person reviewing every merge — is a bug in the
  guide, not a caveat to leave unstated. Guidance that holds only for one
  scale names that scale, or names what changes as the repo grows.
- Keep the README's skill table (name, one rule, branches) in sync with the
  skills and guides.
- Run `mise run ci` before you push.

## Checks

CI only provides `mise` and calls `mise run ci`; a laptop runs the same
tasks. Node comes from the environment; rumdl is pinned in `mise.toml` with
checksums in `mise.lock`.

- `mise run check` — fast: fails on bad frontmatter, a description that does
  not start with `Use when`, duplicate or skipped rule numbers, a missing
  `## Hand off` or `## Done when`, or a README table, count, one-rule cell, or
  guide list out of sync.
- `mise run lint` — fast: fails on Markdown format (prose wraps at 80);
  `mise run fmt` fixes it.
- `mise run links` — full: fails on a broken link, a citation that now
  points at a different rule, a bad skill-loading instruction, an orphaned
  page, or a code-comment citation that names a missing rule.
- `mise run contract` — report only: labels the change unchanged /
  additive / changed / breaking. Removing or renaming a skill or guide is
  breaking: say so in the pull request.
- `mise run ci` — the merge gate: contract, then every tier.
- external links — weekly in `.github/workflows/links.yml`; a broken link
  fails that job, not `mise run ci`.
