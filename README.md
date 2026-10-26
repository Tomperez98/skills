# skills

One rule per skill, branch guides that turn the rule into procedure, and a
description that triggers at exactly the right moment. Five skills, a router,
five workflows, an interview skill, and a skill for writing skills today,
forty-three branch guides, 301 numbered rules.

| Skill | The one rule | Branch guides |
|-------|--------------|---------------|
| [`code`](skills/coding/code/SKILL.md) | Bugs panic, expected failures return values | WRITE · STATE · SHAPE · HTTP_API · LOGIC · PERFORMANCE · REFACTOR · TEST · CRASHONLY · CRASH_TESTS · DEPENDENCIES |
| [`docs`](skills/coding/docs/SKILL.md) | Lead with the reader's task — win the 10-second skim — never mislead | README · API · TUTORIAL · CHANGELOG · LANDING · DOCS_MARKETING |
| [`ship`](skills/coding/ship/SKILL.md) | Keep main releasable; make every release boring — scripted, re-runnable, verified | CI · MONITOR · RELEASE · PUBLISH · COMPAT · ROLLOUT · REVIEW |
| [`mvp`](skills/product/mvp/SKILL.md) | Get a real person to their "aha" in five minutes | PICK · SPEC · RESEARCH · AHA · VALIDATE |
| [`accordant`](skills/coding/accordant/SKILL.md) | Write the contract once, in the spec — and let it judge every response | SPEC · GENERATE · SUITES · COVERAGE · ORACLE · CONCURRENCY · ASYNC · FAULTS · BASELINE · TRACES · DEBUG |
| [`writing-skills`](skills/meta/writing-skills/SKILL.md) | Every line earns its place in the agent's context | NEW · EDIT · PRUNE |
| [`ask`](skills/meta/ask/SKILL.md) | Name one skill and one guide, and read it before you recommend it | — (a router, invoked as `/ask`) |
| [`release`](skills/workflows/release/SKILL.md) | Ship one frozen, green commit, and ask before the first upload | — (a workflow over ship and docs, invoked as `/release`) |
| [`retro`](skills/workflows/retro/SKILL.md) | Fix the mistake where the next agent will meet it: a check if a script can see it, a guide line if it takes judgement | — (a workflow over writing-skills and ship, invoked as `/retro`) |
| [`grill`](skills/meta/grill/SKILL.md) | Settle every decision with the user; look up every fact yourself | — (one procedure, no branch guides) |
| [`implement`](skills/workflows/implement/SKILL.md) | One thin slice at a time: watch its test fail, make it pass, commit | — (a workflow over grill and code, invoked as `/implement`) |
| [`review`](skills/workflows/review/SKILL.md) | Report only findings you tried to refute, most severe first | — (a workflow over code and ship, invoked as `/review`) |
| [`diagnose`](skills/workflows/diagnose/SKILL.md) | Get a red, repeatable signal before you change anything | — (a workflow over code, ship, and accordant, invoked as `/diagnose`) |

## What it is

Skills for AI coding assistants (pi, Claude, Codex). Each skill is one
load-bearing idea stated in one sentence, and the branch guides turn that
idea into rules the agent can actually follow. The one rule is the contract;
the branches are the procedure.

## Install

```bash
npx skills add Tomperez98/skills
```

The [`skills`](https://github.com/vercel-labs/skills) CLI finds every skill,
detects which agents you have installed, and asks where to put them.
Target pi (or any agent) globally in one shot:

```bash
npx skills add Tomperez98/skills -g -a pi
```

Preview before installing with `npx skills add Tomperez98/skills --list`.

Already have the repo? Copy the folders directly — Claude and Codex read
the same layout (`~/.claude/skills`, `~/.codex/skills`):

```bash
cp -r skills/*/* ~/.pi/agent/skills/
```

## How it works

The `description` in each `SKILL.md` decides when the skill fires:

```yaml
name: code
description: >
  Write code that fails fast and tests well. One rule: bugs panic, expected
  failures return values. Use when the user writes, tests, or refactors code,
  finds it hard to test, designs an API, reads config, env vars, a cache, or a
  schema, names or splits a function, simplifies a condition, adds a
  dependency, or asks about error handling, performance, or crash safety —
  even if they never say "testability" or "fail fast".
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
| "Make docs acquire / convert" | [`docs/DOCS_MARKETING.md`](skills/coding/docs/DOCS_MARKETING.md) | One page, one search intent, the example is the ad, convert at the moment of success |
| "Set up / fix / speed up CI" | [`ship/CI.md`](skills/coding/ship/CI.md) | Runnable locally, fast checks first, test the merged result, reproducible and actionable failures |
| "Catch regressions after merge" | [`ship/MONITOR.md`](skills/coding/ship/MONITOR.md) | Slow tests and key metrics on main, re-check the outside world, every failure reaches a person |
| "Plan the release process" | [`ship/RELEASE.md`](skills/coding/ship/RELEASE.md) | Written checklist, never rush, one source for the version, freeze a tested commit, fix forward |
| "Write / fix the release script" | [`ship/PUBLISH.md`](skills/coding/ship/PUBLISH.md) | Build once and ship those bytes, check first, idempotent steps, verify from the outside |
| "Is this a breaking change" | [`ship/COMPAT.md`](skills/coding/ship/COMPAT.md) | Check shape and behavior, the released contract judges every build, declare every break |
| "Several services ship together / deploy order" | [`ship/ROLLOUT.md`](skills/coding/ship/ROLLOUT.md) | Release in lockstep, test N-1 ⇄ N both ways, test in deploy order, enforce the window at runtime, messages and data outlive the deploy |
| "Route review by contract change" | [`ship/REVIEW.md`](skills/coding/ship/REVIEW.md) | Label every pull request by its contract effect, post the promise diff from a job that runs none of its code, labels as information first, watch the gate's numbers |
| "I need an idea / what should I build" | [`mvp/PICK.md`](skills/product/mvp/PICK.md) | Start from a trend, name the idea in one sentence, prefer the shortest path to value |
| "I have an idea — shape it / spec it" | [`mvp/SPEC.md`](skills/product/mvp/SPEC.md) | One specific paragraph: imagine the interface, bullet the details, react to the first implementation |
| "Is this premise actually real / research the trend" | [`mvp/RESEARCH.md`](skills/product/mvp/RESEARCH.md) | Evidence for the trend, the incumbents, and the gap — de-risk the premise, never the value |
| "What's the core use case / cut the feature list" | [`mvp/AHA.md`](skills/product/mvp/AHA.md) | One core use case, cut the feature list, map the five-minute journey to the aha |
| "Is this any good / will people use it" | [`mvp/VALIDATE.md`](skills/product/mvp/VALIDATE.md) | Put it in front of a real person, time it to the aha, act on the verdict |
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
| "Write a new skill or instruction file" | [`writing-skills/NEW.md`](skills/meta/writing-skills/NEW.md) | Packaging by who must reach it, one rule, a description that triggers, pointers with triggers, checkable ends |
| "Change what a skill does" | [`writing-skills/EDIT.md`](skills/meta/writing-skills/EDIT.md) | Find the layer that caused it, edit the one source of truth, keep citations true, label the change |
| "A skill is too long or ignored" | [`writing-skills/PRUNE.md`](skills/meta/writing-skills/PRUNE.md) | Measure, remove duplicates and no-ops, positive phrasing, split by situation, sharpen the ends |

## Flows

The skills hand off to each other. Not sure where you are? Type `/ask`
and describe it: the router names the skill and guide. Most work runs
along one path:

```text
mvp  PICK → RESEARCH → SPEC → AHA → VALIDATE
       ↓ build it
code WRITE ⇄ TEST        accordant SPEC → GENERATE → SUITES   (stateful APIs)
       ↓ document it
docs README · API · CHANGELOG
       ↓ release it
ship CI → RELEASE → PUBLISH   ·   COMPAT (accordant BASELINE runs the old spec)
```

Each `SKILL.md` ends with a **Hand off** section naming the skill that
picks up next and the guide to follow. A guide that needs another skill
says so as an instruction: `call the Skill tool with "ship" and follow its
CI.md`. A citation like "ship skill, CI.md rule 7" stays a reference: it
explains why, and doesn't ask the agent to load anything.

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
what to do. Read [`writing-skills/NEW.md`](skills/meta/writing-skills/NEW.md)
before you start; keep the rule honest and the examples runnable.
