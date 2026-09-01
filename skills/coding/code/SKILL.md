---
name: code
description: >
  Write code that fails fast, recovers fast, and tests well. One rule: bugs
  panic, expected failures return values. Use when the user writes or tests
  code, says code is hard to test, refactors for testability, designs APIs,
  or asks about mocking, error handling, panics, assertions, naming,
  performance, resource limits, crash-only design, crash safety, graceful
  shutdown, recovery, restart/retry, idempotency, supervisors, cancellation,
  or leases and timeouts — even if they never say "testability" or "fail fast".
---

# Code

Write code that crashes the moment an assumption breaks, and returns a value
for every failure the caller should handle. Everything in this skill follows
from one rule:

> **Bugs panic, expected failures return values.**

## Pick a branch

Identify which situation you're in — from the user's prompt, the surrounding
code, or by asking if the user is around:

- **"Write this / design this API / add this feature"** → [WRITE.md](WRITE.md).
  Build the fail-fast contract and structure for testability as you go.
- **"Make this crash-safe / recover fast / crash-only / restart/retry"** →
  [CRASHONLY.md](CRASHONLY.md). Design the crash and recovery paths so a
  panic is safe and cheap.
- **"This code is hard to test / untestable / help me refactor"** →
  [REFACTOR.md](REFACTOR.md). Diagnose which principle the code violates and
  fix that first, before writing tests.
- **"Write tests for this"** → [TEST.md](TEST.md). Apply the testing
  techniques that the structure makes available.

The four branches produce very different output, so getting this wrong
wastes the work. If the situation is genuinely ambiguous and the user isn't
reachable, default to whichever branch matches the surrounding code (a
feature/page/component → WRITE; a shutdown/recovery/crash-safety concern →
CRASHONLY; a complaint about testing pain → REFACTOR; an explicit request
for tests → TEST) and state the assumption at the top of your work.

## The one rule

**Bugs panic, expected failures return values.**

- **Panic** (assert / throw / abort — whatever your language calls a crash)
  when the program hits a state that *should be impossible* — a broken
  invariant, incorrect API usage, or arithmetic that would silently produce
  a wrong answer. Fail loudly, at the exact line, so the damage stops there
  instead of cascading.
- **Return a value** (a Result/Either type, a tagged union, a nullable — an
  error the caller handles) when failure is *expected* and the caller should
  decide what to do — network errors, file I/O, user input that can
  legitimately be rejected, business rules that can refuse.

Failing fast is what makes code testable: a function either returns one of
its documented failures, or it guarantees its invariants hold — and that
contract is exactly what a test asserts. WRITE builds the contract, REFACTOR
recovers it, TEST proves it, and CRASHONLY makes the panic itself safe and
cheap: a component you can kill at any instant and recover in milliseconds.

## Sources

- [Fail-fast — tomperez98.github.io](https://tomperez98.github.io/posts/fail-fast/)
- [Can we test it? Yes, we can! — Mitchell Hashimoto](https://www.youtube.com/watch?v=MqC3tudPH6w)
- [Better Result — Application patterns](https://better-result.dev/guides/application-patterns)
- [Better Result — Testing](https://better-result.dev/guides/testing)
- [Handles are the better pointers — floooh](https://floooh.github.io/2018/06/17/handles-vs-pointers.html)
- [An Introduction to Data-Oriented Design — jamesmcm](https://jamesmcm.github.io/blog/intro-dod/)
- [TigerStyle — tigerstyle.dev](https://tigerstyle.dev/)
- [The Power of Ten Rules — Gerard J. Holzmann](https://spinroot.com/gerard/pdf/P10.pdf)
- [Crash-Only Software — Candea & Fox, HotOS 2003](https://www.usenix.org/legacy/events/hotos03/tech/full_papers/candea/candea_html/index.html)
- [Cancelation Terminology — matklad](https://matklad.github.io/2026/08/31/cancelation-terminology.html)
