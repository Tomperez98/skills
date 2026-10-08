# skills

One rule per skill, branch guides that turn the rule into procedure, and a
description that triggers at exactly the right moment. Five skills today,
twenty-eight branch guides, 222 numbered rules.

| Skill | The one rule | Branch guides |
|-------|--------------|---------------|
| [`code`](skills/coding/code/SKILL.md) | Bugs panic, expected failures return values | WRITE · PERFORMANCE · REFACTOR · TEST · CRASHONLY · DEPENDENCIES |
| [`docs`](skills/coding/docs/SKILL.md) | Lead with the reader's task — win the 10-second skim — never mislead | README · API · TUTORIAL · CHANGELOG · LANDING · DOCS_MARKETING |
| [`ship`](skills/coding/ship/SKILL.md) | Keep main releasable; make every release boring — scripted, re-runnable, verified | CI · MONITOR · RELEASE · PUBLISH |
| [`accordant`](skills/coding/accordant/SKILL.md) | Write the contract once, in the spec — and let it judge every response | SPEC · GENERATE · ORACLE · CONCURRENCY · ASYNC · FAULTS · DEBUG |
| [`mvp`](skills/product/mvp/SKILL.md) | Get a real person to their "aha" in five minutes | PICK · SPEC · RESEARCH · AHA · VALIDATE |

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
cp -r skills/coding/code skills/coding/docs skills/coding/ship skills/coding/accordant skills/product/mvp ~/.pi/agent/skills/
```

## How it works

The `description` in each `SKILL.md` decides when the skill fires:

```yaml
name: code
description: >
  Write code that fails fast and tests well. One rule: bugs panic, expected
  failures return values. Use when the user writes, tests, or refactors code,
  finds it hard to test, designs an API or config, adds a dependency, or asks
  about mocking, error handling, assertions, naming, conditionals,
  performance, env vars, crash-only design, retry, idempotency, cancellation,
  or timeouts — even if they never say "testability" or "fail fast".
```

When a task matches, the agent reads the branch that fits the situation and
follows its rules in order:

| Situation | Branch guide | What it does |
|-----------|--------------|--------------|
| "Write this feature / design this API" | [`code/WRITE.md`](skills/coding/code/WRITE.md) | Panic on broken invariants, return values for expected failures, parse at the edge, configure explicitly at the edge, one error vocabulary per boundary |
| "Make this faster / optimize this hot path" | [`code/PERFORMANCE.md`](skills/coding/code/PERFORMANCE.md) | Sketch costs before you build, keep the hot path free of indirection, split the control plane from the data plane |
| "This code is hard to test / simplify this conditional" | [`code/REFACTOR.md`](skills/coding/code/REFACTOR.md) | Diagnose which principle the code violates, fix that first — then the tests write themselves |
| "Write tests for this" | [`code/TEST.md`](skills/coding/code/TEST.md) | Assert the shape before the payload, one test per error variant, test short-circuiting |
| "Make this crash-safe / recover fast / crash-only" | [`code/CRASHONLY.md`](skills/coding/code/CRASHONLY.md) | Stop = crash, start = recover: make the panic safe and the recovery cheap |
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
| "Model this system / write a spec / add an operation" | [`accordant/SPEC.md`](skills/coding/accordant/SPEC.md) | Minimal state, guards in implementation order, strong predicates, one outcome per branch |
| "Generate tests / bind the client / run them" | [`accordant/GENERATE.md`](skills/coding/accordant/GENERATE.md) | Bind with exact types, reset, pick inputs, bound the graph, run every response through the spec |
| "Validate existing tests / traces / a non-.NET system" | [`accordant/ORACLE.md`](skills/coding/accordant/ORACLE.md) | The spec as a pure judge: `Allows`, traces, exported test plans, a trace database for the spec itself |
| "Find race conditions / double booking / lost updates" | [`accordant/CONCURRENCY.md`](skills/coding/accordant/CONCURRENCY.md) | Sequential green first, then linearizability over small concurrent groups |
| "Background jobs / polling / eventual completion" | [`accordant/ASYNC.md`](skills/coding/accordant/ASYNC.md) | Step functions in the model, polling and derivations at test time, liveness as a bound |
| "Timeouts / 500s / retries / fault injection" | [`accordant/FAULTS.md`](skills/coding/accordant/FAULTS.md) | Every explanation of an ambiguous response is an outcome; the state profile carries all of them |
| "The spec crashes / tests fail / generation explodes" | [`accordant/DEBUG.md`](skills/coding/accordant/DEBUG.md) | Decide whether the spec or the system is wrong before touching either |
| "I need an idea / what should I build" | [`mvp/PICK.md`](skills/product/mvp/PICK.md) | Start from a trend, name the idea in one sentence, prefer the shortest path to value |
| "I have an idea — shape it / spec it" | [`mvp/SPEC.md`](skills/product/mvp/SPEC.md) | One specific paragraph: imagine the interface, bullet the details, react to the first implementation |
| "Is this premise actually real / research the trend" | [`mvp/RESEARCH.md`](skills/product/mvp/RESEARCH.md) | Evidence for the trend, the incumbents, and the gap — de-risk the premise, never the value |
| "What's the core use case / cut the feature list" | [`mvp/AHA.md`](skills/product/mvp/AHA.md) | One core use case, cut the feature list, map the five-minute journey to the aha |
| "Is this any good / will people use it" | [`mvp/VALIDATE.md`](skills/product/mvp/VALIDATE.md) | Put it in front of a real person, time it to the aha, act on the verdict |

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
what to do. Copy the shape of the existing skills; keep the rule honest and
the examples runnable.
