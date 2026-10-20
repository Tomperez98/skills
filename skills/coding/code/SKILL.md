---
name: code
description: >
  Write code that fails fast and tests well. One rule: bugs panic, expected
  failures return values. Use when the user writes, tests, or refactors code,
  finds it hard to test, designs an API or config, adds a dependency, or
  asks about error handling, performance, or crash safety — even if they
  never say "testability" or "fail fast".
---

# Code

Write code that crashes the moment an assumption breaks, and returns a value
for every failure the caller should handle. Everything in this skill follows
from one rule:

> **Bugs panic, expected failures return values.**

- **Panic** (assert / throw / abort — whatever your language calls a crash)
  when the program hits a state that *should be impossible* — a broken
  invariant, incorrect API usage, or arithmetic that would silently produce
  a wrong answer. The crash lands at the exact line, so the damage stops
  there instead of cascading.
- **Return a value** (a Result/Either type, a tagged union, a nullable — an
  error the caller handles) when failure is *expected* and the caller should
  decide what to do — network errors, file I/O, user input that can
  legitimately be rejected, business rules that can refuse.

Failing fast is what makes code testable: a function either returns one of
its documented failures, or it guarantees its invariants hold — and that
contract is exactly what a test asserts. The branches build it, recover it,
prove it, make the panic safe, keep it fast, and hold code you didn't write
to it.

## Pick a branch

Identify the situation from the user's prompt or the surrounding code. When
it is ambiguous and the user isn't reachable, take the default in
parentheses and state the assumption at the top of your work.

- **Write a feature or function** (default for a feature, page, or
  component) → [WRITE.md](WRITE.md).
- **Read config, env vars, globals, caches, or a schema** →
  [STATE.md](STATE.md).
- **Design an in-process interface, name things, add an abstraction, split
  a function** → [SHAPE.md](SHAPE.md).
- **Design an HTTP or network API** (REST, GraphQL, RPC, pagination,
  versioning, auth) → [HTTP_API.md](HTTP_API.md).
- **Simplify a conditional or a multi-input decision** →
  [LOGIC.md](LOGIC.md).
- **Too slow, or a scaling question** → [PERFORMANCE.md](PERFORMANCE.md).
- **Crash safety, recovery, restart, retry** →
  [CRASHONLY.md](CRASHONLY.md).
- **Test recovery, idempotency, or cancellation** →
  [CRASH_TESTS.md](CRASH_TESTS.md).
- **Hard to test, or a tangled design** (default for a complaint about
  testing pain) → [REFACTOR.md](REFACTOR.md).
- **Write tests** (default for an explicit request for tests) →
  [TEST.md](TEST.md).
- **Add, update, or audit a dependency** (default for a manifest, lockfile,
  or Dependabot PR) → [DEPENDENCIES.md](DEPENDENCIES.md).

Where the repo has an error type, a Result or exception style, or a test
layout, those conventions decide the mechanics. They stay inside the one
rule.

## Hand off

When the task crosses into another skill's ground, load it with the Skill
tool rather than carrying on from memory:

- **The API is stateful and order matters** (an earlier call changes what a
  later one returns) → call the Skill tool with "accordant" and follow
  SPEC.md: a spec judges those sequences better than tests written one at a
  time.
- **Gating the merge on the compiler, analyzers, or tests** → call the
  Skill tool with "ship" and follow CI.md.
- **Documenting the API's errors and operations** → call the Skill tool
  with "docs" and follow API.md.
