# skills

One rule per skill, branch guides that turn the rule into procedure, and a
description that triggers at exactly the right moment. Four skills, 35
branch guides, 256 numbered rules.

| Skill | The one rule | Branch guides |
|-------|--------------|---------------|
| [`code`](skills/coding/code/SKILL.md) | Bugs panic, expected failures return values | WRITE · STATE · SHAPE · HTTP_API · LOGIC · PERFORMANCE · REFACTOR · TEST · CRASHONLY · CRASH_TESTS · DEPENDENCIES |
| [`docs`](skills/coding/docs/SKILL.md) | Lead with the reader's task — win the 10-second skim — and never mislead | README · API · TUTORIAL · CHANGELOG · LANDING · DOCS_MARKETING |
| [`ship`](skills/coding/ship/SKILL.md) | Keep main releasable; make every release boring — scripted, re-runnable, verified | CI · MONITOR · RELEASE · PUBLISH · COMPAT · ROLLOUT · REVIEW |
| [`accordant`](skills/coding/accordant/SKILL.md) | Write the contract once, in the spec — and let it judge every response | SPEC · GENERATE · SUITES · COVERAGE · ORACLE · CONCURRENCY · ASYNC · FAULTS · BASELINE · TRACES · DEBUG |

## What it is

Skills for AI coding assistants. Each skill is one load-bearing idea stated
in one sentence, and the branch guides turn that idea into rules the agent
can actually follow. The one rule is the contract; the branches are the
procedure.

They follow the
[Agent Skills specification](https://agentskills.io/specification), so any
agent that loads `SKILL.md` can use them. The install below covers Claude
Code, Codex, and Pi.

## Install

```bash
npx skills add Tomperez98/skills
```

The [`skills`](https://github.com/vercel-labs/skills) CLI finds every skill,
detects your agents, and installs into the current project by default. Add
`-g` to install for every project, and `-a` to target one agent:

```bash
npx skills add Tomperez98/skills -g -a pi
```

Preview before installing with `npx skills add Tomperez98/skills --list`.
Nested category folders such as `skills/<category>/<skill>` need `skills`
1.5.22 or newer; `npx skills@latest` is enough.

The CLI writes each agent's own skills directory. To copy by hand, use that
agent's global or project path and create it first:

| Agent | Global | Project |
|-------|--------|---------|
| Claude Code | `~/.claude/skills/` | `.claude/skills/` |
| Codex | `~/.agents/skills/` | `.agents/skills/` |
| Pi | `~/.pi/agent/skills/` or `~/.agents/skills/` | `.pi/skills/` or `.agents/skills/` |

From the repo root:

```bash
mkdir -p ~/.agents/skills
cp -r skills/*/* ~/.agents/skills/
```

Prefer the CLI: it symlinks the skills, so `npx skills update` refreshes
them. A manual copy must be re-copied to update.

## Pair with a process framework

These four skills are the *content layer*: they say what the output must
obey. A process framework is the *outer loop*: it decides when and how the
work proceeds — when to brainstorm, plan, test first, review, and ship.
Install the framework you use alongside these skills. The two layers
compose: the process skill runs first, then the content rule applies inside
each step. If you do not use a process framework, the content skills still
work on their own.

### Route the overlaps once

Put this note where your agent reads project instructions, so the two layers
hand off instead of colliding. Codex and Pi read `AGENTS.md`; Claude Code
reads `CLAUDE.md` (and `AGENTS.md` only when no `CLAUDE.md` exists, unless
you enable `claude-md-and-agents-md`).

```text
These skills are the content layer. If you use a process framework, it owns
the loop — when to brainstorm, plan, test, review, and ship. Apply the
content skill inside each step; don't let it replace the process.

- Write a feature -> brainstorm, plan, then code WRITE
- Write tests     -> your TDD loop; code TEST owns the shape of a good test
- Fix a bug       -> your debugging step finds the cause; code owns the fix
- Write docs      -> docs (the process framework owns timing, not README/API content)
- Ship a release  -> ship RELEASE; the process framework decides when it is allowed
- Model a system  -> accordant; a spec judges stateful sequences, and trace
                     replay covers what it can't call

If no process framework is installed, use the content skill directly.
```

Overlap is expected: on "write tests" both the TDD loop and `code` fire —
the note is what puts the loop and the assertions in different skills.

Installed skills share one name space in an agent. If a process framework
also installs a skill named `code`, `docs`, `ship`, or `accordant`, rename or
remove one before relying on the hand-off instructions.

## How it works

The `description` in each `SKILL.md` decides when the skill fires — triggers
only, never a summary of the one rule:

```yaml
name: code
description: >
  Use when the user writes, tests, or refactors code, finds it hard to test,
  designs an API, reads config, env vars, a cache, or a schema, names or
  splits a function, simplifies a condition, adds a dependency, or asks about
  error handling, performance, or crash safety — even if they never say
  "testability" or "fail fast".
```

When a task matches, the agent reads the branch that fits the situation and
follows its rules in order:

| Situation | Branch guide | What it does |
|-----------|--------------|--------------|
| "Write this feature / design this API" | [`code/WRITE.md`](skills/coding/code/WRITE.md) | Panic on broken invariants, return values for expected failures, parse at the edge, one error vocabulary per boundary, state the contract, bound everything |
| "Read config / env vars / a cache / a schema" | [`code/STATE.md`](skills/coding/code/STATE.md) | Tame globals, configure explicitly at the edge, load only the state you need, pass identity, let the store enforce invariants |
| "Design an interface / name things / split a function" | [`code/SHAPE.md`](skills/coding/code/SHAPE.md) | A small named surface, seams only where a second implementation is real, few branches at the call site, the type holds the guarantee |
| "Design an HTTP API / choose REST vs GraphQL vs RPC" | [`code/HTTP_API.md`](skills/coding/code/HTTP_API.md) | Protocol by caller, resources and methods, stateless requests, safe retries, pagination, one error envelope, versioning, auth and rate limits |
| "Simplify a condition / a multi-input decision" | [`code/LOGIC.md`](skills/coding/code/LOGIC.md) | Conditions as logic, one rewrite per step, decisions as complete tables |
| "Make this faster / optimize this hot path" | [`code/PERFORMANCE.md`](skills/coding/code/PERFORMANCE.md) | Sketch costs before you build, keep the hot path free of indirection, split the control plane from the data plane |
| "This code is hard to test / a refactor fights back" | [`code/REFACTOR.md`](skills/coding/code/REFACTOR.md) | Diagnose which principle the code violates, fix that first — then the tests write themselves |
| "Write tests for this" | [`code/TEST.md`](skills/coding/code/TEST.md) | Assert the shape before the payload, one test per error variant, test short-circuiting |
| "Make this crash-safe / recover fast / crash-only" | [`code/CRASHONLY.md`](skills/coding/code/CRASHONLY.md) | Stop = crash, start = recover: make the panic safe and the recovery cheap |
| "Test crash recovery / idempotency / cancellation" | [`code/CRASH_TESTS.md`](skills/coding/code/CRASH_TESTS.md) | Kill mid-write and restart, double-apply, ack before release |
| "Add / update this dependency" | [`code/DEPENDENCIES.md`](skills/coding/code/DEPENDENCIES.md) | Own every dependency, pin it, update on purpose, review in proportion to risk |
| "Write / fix the README" | [`docs/README.md`](skills/coding/docs/README.md) | Win the 10-second skim: hero, what-it-is, install, one working example, link onward |
| "Write / fix API docs" | [`docs/API.md`](skills/coding/docs/API.md) | Signature first, name the fault model, one example per operation |
| "Write / fix a tutorial" | [`docs/TUTORIAL.md`](skills/coding/docs/TUTORIAL.md) | One scoped outcome, copy-paste steps, observable output |
| "Write / fix a changelog" | [`docs/CHANGELOG.md`](skills/coding/docs/CHANGELOG.md) | Impact first, breaking changes loudest, Keep a Changelog + SemVer |
| "Write landing copy" | [`docs/LANDING.md`](skills/coding/docs/LANDING.md) | Position before you write, hero leads with the job, proof over adjectives |
| "Write a blog post / launch post" | [`docs/DOCS_MARKETING.md`](skills/coding/docs/DOCS_MARKETING.md) | One search intent, a self-sufficient page, the example as the ad, convert after it works |
| "Make docs acquire / convert" | [`docs/DOCS_MARKETING.md`](skills/coding/docs/DOCS_MARKETING.md) | One page, one search intent, the example is the ad, convert at the moment of success |
| "Set up / fix / speed up CI" | [`ship/CI.md`](skills/coding/ship/CI.md) | Runnable locally, fast checks first, test the merged result, reproducible and actionable failures |
| "Catch regressions after merge" | [`ship/MONITOR.md`](skills/coding/ship/MONITOR.md) | Slow tests and key metrics on main, re-check the outside world, every failure reaches a person |
| "Plan the release process" | [`ship/RELEASE.md`](skills/coding/ship/RELEASE.md) | Written checklist, never rush, one source for the version, freeze a tested commit, fix forward |
| "Write / fix the release script" | [`ship/PUBLISH.md`](skills/coding/ship/PUBLISH.md) | Build once and ship those bytes, check first, idempotent steps, verify from the outside |
| "Is this a breaking change" | [`ship/COMPAT.md`](skills/coding/ship/COMPAT.md) | Check shape and behavior, the released contract judges every build, declare every break |
| "Several services ship together / deploy order" | [`ship/ROLLOUT.md`](skills/coding/ship/ROLLOUT.md) | Release in lockstep, test N-1 ⇄ N both ways, test in deploy order, enforce the window at runtime, messages and data outlive the deploy |
| "Route review by contract change" | [`ship/REVIEW.md`](skills/coding/ship/REVIEW.md) | Label every pull request by its contract effect, post the promise diff from a job that runs none of its code, labels as information first, watch the gate's numbers |
| "Model this system / write an Accordant spec" | [`accordant/SPEC.md`](skills/coding/accordant/SPEC.md) | The contract, not a second implementation: minimal state, guards in the contract's order, payload-checking predicates, capture what you can't predict |
| "Generate tests / run them against my API" | [`accordant/GENERATE.md`](skills/coding/accordant/GENERATE.md) | Bind exact types, reset to the initial state, few branch-aimed inputs, bound and look at the graph, then run |
| "Many suites / slow suite / OOM / case count doubled" | [`accordant/SUITES.md`](skills/coding/accordant/SUITES.md) | One owner per operation, one plan entry per suite, measure then budget, growth is a scoping bug |
| "Green, but would it catch a bug / a branch never runs" | [`accordant/COVERAGE.md`](skills/coding/accordant/COVERAGE.md) | Audit code coverage, walk the cycles, swarm, prove each rule's sequence runs, mutate |
| "Validate my tests / traces / a non-.NET system" | [`accordant/ORACLE.md`](skills/coding/accordant/ORACLE.md) | One `spec.Allows` call threaded through a state profile; traces from any language, concurrent segments, exported plans, events |
| "Find race conditions" | [`accordant/CONCURRENCY.md`](skills/coding/accordant/CONCURRENCY.md) | Sequential green first, colliding inputs, linearizability does the asserting, pin each race as a case, one green run is not proof |
| "Background jobs / polling" | [`accordant/ASYNC.md`](skills/coding/accordant/ASYNC.md) | Step functions in the model, polling and derivations in the runner, `MaxRetryCount` as the liveness bound, polling off to act mid-job |
| "Timeouts / 500s / fault injection" | [`accordant/FAULTS.md`](skills/coding/accordant/FAULTS.md) | Every explanation of an ambiguous response is an outcome; explore without faults, execute with them |
| "Is the new version backward compatible" | [`accordant/BASELINE.md`](skills/coding/accordant/BASELINE.md) | The release's suite and sequences, unchanged, run against the new build through a strict client; closed sets don't grow silently; the upgrade runs over existing data; with several services, each suite runs both directions |
| "I changed the spec — is it still right" | [`accordant/TRACES.md`](skills/coding/accordant/TRACES.md) | Replay a trace database on every spec change, mutate traces the spec must reject, exercise every outcome, post the spec diff as a contract change |
| "My spec crashes / tests fail" | [`accordant/DEBUG.md`](skills/coding/accordant/DEBUG.md) | Name the failure first: spec crash, spec rejection, or setup — then fix the right one |

## How skills hand off

Each `SKILL.md` ends with a **Hand off** section naming the skill that
picks up next and the guide to follow. A guide that needs another skill
says so as an instruction: `load the "ship" skill and follow its CI.md`.
That is plain language, not a tool call: the agent loads the named skill,
then reads the guide from that skill's directory. A citation like "ship
skill, CI.md rule 7" stays a reference: it explains why, and doesn't ask the
agent to load anything. If your agent namespaces skills (for example
`plugin:skill`), use the namespaced name for the hand-off.

## Why one rule

A skill with twenty principles applies none of them. One rule fits in the
agent's working memory and reads as a test: either the output obeys it or
it doesn't. The branches exist so the rule isn't a slogan — each one is a
procedure, applied in order, for a specific situation. If the situation is
genuinely ambiguous, the skill says so: pick the branch that matches the
surrounding code and state the assumption at the top.

## Adding a skill

A new skill is three things: a one-sentence rule, a `description` that
triggers at the right moment, and branch guides that tell the agent exactly
what to do. Use your process framework's skill-authoring guide when one is
available, otherwise follow the
[Agent Skills specification](https://agentskills.io/specification); keep the
rule honest, label pseudocode as pseudocode, and cut any example that claims
to run from a file CI runs.
