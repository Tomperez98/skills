# Skills

Give your coding agent rules for writing code, docs, releases, and its own skills, loaded only when the task calls for them.

```sh
npx skills add Tomperez98/skills
```

This uses the [skills.sh](https://www.skills.sh/) CLI. It needs Node.js 22.20 or later, asks which skills and agents to install to, and installs into the current project by default. Add `-g` to install for every project. To install one skill for one agent:

```sh
npx skills add Tomperez98/skills --skill writing-code -a claude-code
```

The CLI sends anonymous telemetry by default. Set `DISABLE_TELEMETRY=1` to opt out.

## What's in it

Each skill is a `SKILL.md` plus `reference/*.md` files. The agent keeps only the name and description in context. It reads `SKILL.md` when the task matches, and a reference file only when `SKILL.md` links that file to the task at hand.

| Skill | Use it to | Reference files |
| --- | --- | --- |
| [`writing-code`](skills/writing-code/SKILL.md) | Write, change, or review code: errors vs. panics, contracts, config, tests, dependencies, HTTP APIs | `conditions`, `config`, `crash-only`, `dependencies`, `http-apis`, `performance`, `tests` |
| [`writing-docs`](skills/writing-docs/SKILL.md) | Write READMEs, API references, tutorials, changelogs, landing pages, launch posts | `readme`, `api-reference`, `tutorials`, `changelogs`, `landing-pages`, `growth-content` |
| [`shipping-changes`](skills/shipping-changes/SKILL.md) | Set up CI, check compatibility, cut releases, publish packages, roll out across services, watch main | `ci`, `compatibility`, `review-routing`, `watching-main`, `releases`, `publishing`, `rollout` |
| [`writing-skills`](skills/writing-skills/SKILL.md) | Write or review a skill: frontmatter, progressive disclosure, scripts, evals | `workflows`, `scripts`, `evaluation` |

The rules are language-, framework-, and tool-agnostic. Examples are pseudocode, so the agent translates them to your stack.

[`writing-skills`](skills/writing-skills/SKILL.md) is the rulebook for every skill here, including itself.

## Check your changes

[mise](https://mise.jdx.dev) pins the toolchain (Node and [rumdl](https://github.com/rvben/rumdl)). The same command runs locally and in CI:

```sh
mise run ci
```

It runs three steps in order, and a failure in any one fails the run:

| Task | What it does |
| --- | --- |
| `mise run lint` | Lints Markdown with rumdl. `mise run fmt` fixes what it reports. |
| `mise run test-scripts` | Runs the unit tests for the checker in `scripts/`. |
| `mise run check-skills` | Checks every skill against the `writing-skills` rules. Warnings fail too. |

`check-skills` enforces frontmatter limits, `SKILL.md` under 500 lines, working links, a table of contents on long reference files, and an eval file for every skill. `scripts/` uses Node built-ins only, so there's nothing to `npm install`.

## Layout

```text
skills/<name>/SKILL.md          the skill
skills/<name>/reference/*.md    loaded one at a time, by task
evals/<name>.json               at least 3 scenarios per skill
evals/fixtures/                 files the eval scenarios point at
scripts/check_skills.mjs        the checker, with tests beside it
mise.toml                       pinned tools and tasks
```

## Contributing

Read [AGENTS.md](AGENTS.md) first. It covers the commands, the rules for editing skills, and the eval format. Run `mise run ci` before you open a pull request.
