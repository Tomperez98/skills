---
name: writing-code
description: Applies language-agnostic engineering rules for errors vs. panics, contracts, bounded loops, types, config, crash-only design, tests, dependencies, HTTP APIs, security, logging and metrics, debugging, code review, and framework APIs. Use when writing, modifying, refactoring, simplifying, or reviewing code, designing a module or API, adding a dependency, writing tests, fixing a bug or failing test, handling errors, retries, idempotency, timeouts, or configuration, handling untrusted input, auth, or secrets, adding logs, metrics, or traces, optimizing a slow path, or calling a framework or library API.
---

# Writing code

These rules are language-, framework-, and tool-agnostic. Examples are pseudocode, so translate the shape to the project's stack, and let repo conventions decide mechanics. If another workflow skill is active, it owns the steps. Apply these rules inside each step. On conflict between a workflow skill's coding advice and these rules, these rules win. Say so when you override one.

**One rule: bugs panic, expected failures return values.** A panic is any crash: assert, throw, or abort. Panic on states that should be impossible: a broken invariant, API misuse, or arithmetic that would silently give a wrong answer. Return a value the caller must handle for expected failures: network, I/O, input that can be rejected, business rules that can refuse.

## Errors and contracts
- Panic messages name the invariant and the value: `"quantity must be positive, got {q}"`. Never use a bare `unwrap()`. Use `expect("config was validated at startup")`. Add asserts wherever an assumption is clever or load-bearing.
- Let panics reach the top. A catch-all at a unit-of-work boundary (request handler, job loop) may log and abandon that unit, but never resume it on the state the panic left.
- A returned failure must be visible in the signature: a Result, a union, a nullable, or a checked/documented exception. An error invisible in every signature between source and caller is an implicit exception.
- Handle, propagate, or visibly discard every returned error (`_ = log.flush() // best-effort`). Have the compiler enforce it: `#[must_use]`, `[[nodiscard]]`, `errcheck`, `no-floating-promises`.
- Check and extract in one step (`if let Some(u) = user`), not a test followed by a forced unwrap.
- Write errors for the person who must act: what failed, which value, what to do next (`"host 'api.example.com' unreachable: retry, or check --region"`, not `"EIO"`).
- Keep IO at the edges and gather logic into a pure core you can feed arbitrary inputs without mocks.
- One error vocabulary per layer. Translate driver/framework errors once at the boundary, so no `DbError` reaches the domain. Put an operation's steps in one workflow whose return type lists every expected failure. Map results to transport (HTTP codes) in exactly one place, matching the union once.
- State the contract. A precondition violation is the caller's bug, so assert at entry. A postcondition violation (including the named failures) is yours, so assert before returning. Put the contract in types first, then asserts, then a comment for what types can't hold.
- A substitute (subclass, second implementation, next API version) is safe only if it requires no more and promises no less. Breaking changes include tightening validation, adding an error variant, and removing or loosening a result field, even in a patch release.

## Bounds and strictness
- Every loop has a named upper bound: a constant or the collection's length. A `while true` gets a counter or a deadline. Hitting a bound that "can't happen" panics. Hitting one that can happen (e.g. `MAX_REDIRECTS`) returns an error.
- Avoid recursion, or give it an explicit depth limit. Prefer a loop over an explicit, bounded stack.
- Keep control flow local: returns and panics, not `goto`, `longjmp`, or exceptions for normal logic.
- Prefer fixed-width integer types. Treat overflow as a bug until stated otherwise: use checked arithmetic, and return the failure where overflow is expected.
- Size pools, buffers, and caches once at startup from config. In GC'd languages, every growing collection has a cap.
- Turn on the strictest compiler and linter settings and warnings-as-errors from the first commit. Keep the warning count at zero.
- Justify every escape hatch (`unsafe`, `any`, a cast, `@ts-expect-error`) on its line with the invariant that makes it correct (cf. `// SAFETY:`). Wrap it behind an interface callers can't misuse.
- No wildcard arm when matching a union you own. Write unhandled variants out by name and panic on them.
- When the analyzer can't prove code safe, rewrite the code instead of silencing the tool.

## Shape
- Interfaces: one naming pattern (`VerbNoun` unless the codebase uses the reverse). One operation means one request type and one response type. A request that includes another operation's input carries that request instead of redeclaring its fields. Use closed enums for lifecycle states and outcomes (`created | duplicate | expired`), not booleans or strings. State which operations are safe to repeat.
- Push control flow up and data flow down: callers decide, leaves compute. Put nondeterministic physical interfaces (clock, network, disk) behind deterministic logical ones.
- Add a seam (an interface the work function takes as a parameter) only at a boundary that really varies at test time. The fake is a plain value, not a mock library.
- Minimize branches at the call site. Return the simplest type that answers the question (bool > count > nullable > enum). Declare each variable in the smallest scope that works.
- Names: put qualifiers after the base name and the most significant word first (`user_id`, `revenue_total`). Give related names the same length (`source`/`target`). Name fields, not positions (`range.end`, not `pair.1`).
- Climb the metaprogramming ladder last: function/type, then declarative macro, then codegen, then compiler plugin.
- Split long functions by role: branching stays in the parent, loops and computation go into leaf helpers. If a helper can only be named `step_two`, the split is wrong. Stop at the natural size.
- Let the type hold the guarantee. Use a set for unique/unordered data, a bag for duplicates without order, an ordered set for order without duplicates, and a list only when order and duplicates both matter. Know whether your language's set compares by identity or by value.
- Use a new type (not an alias) for any value that can be mixed up. Validate in its constructor (`Email::parse(s) -> Result<Email, _>`), so holding it proves validity.
- Show absence in the type (option or checked nullable), never as a sentinel (`NaN`, `-1`, `""`, `NULL`). Pick the default at the call site.
- Comments: give a one-sentence module overview. Explain the outside world (vendor quirks, laws, exchange rules). Say what the code doesn't handle, and mark deliberate slowness (`// perf: don't simplify`). Delete a comment before letting it go stale.

## Load when the task matches
Read the whole file before starting that part of the task:
- Writing or changing tests → [reference/tests.md](reference/tests.md)
- Decision logic over several inputs, or rewriting conditions → [reference/conditions.md](reference/conditions.md)
- Env vars, config, globals, IDs across boundaries, DB constraints → [reference/config.md](reference/config.md)
- Services, workers, retries, timeouts, leases, shutdown, recovery → [reference/crash-only.md](reference/crash-only.md)
- Adding, updating, or wrapping a dependency → [reference/dependencies.md](reference/dependencies.md)
- Designing or changing HTTP, REST, gRPC, or GraphQL endpoints → [reference/http-apis.md](reference/http-apis.md)
- Design-time sizing, a slow path, queries, indexes, pools, caches, or a hot loop a profiler named → [reference/performance.md](reference/performance.md)
- Untrusted input, auth and authorization, secrets, sessions, file paths, outbound URLs, personal data → [reference/security.md](reference/security.md)
- Logs, metrics, traces, correlation IDs → [reference/observability.md](reference/observability.md)
- A bug, a failing or flaky test, an error you must diagnose → [reference/debugging.md](reference/debugging.md)
- Reviewing a diff or PR, refactoring, simplifying, or deleting code → [reference/reviews.md](reference/reviews.md)
- Code against a framework or library API whose behavior varies by version → [reference/framework-apis.md](reference/framework-apis.md)

## Before finishing
Review the diff against this list. Fix each miss and re-check until the list is clean:
- [ ] Every new panic names the invariant and the value. No bare `unwrap()`.
- [ ] Every returned error is handled, propagated, or visibly discarded, and shows in the signature.
- [ ] Every new loop, retry, and call has a named bound or a timeout.
- [ ] No wildcard arm on a union you own. Every escape hatch is justified on its line.
- [ ] No `getenv` below the edge, and no config fallback to a dev default.
- [ ] The diff lowers no bar: no unjustified suppression, skipped or deleted test, removed assertion, empty `catch`, stub, or loosened check.
- [ ] Each reference file the task matched was read and applied.
