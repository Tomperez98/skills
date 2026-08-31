# Refactoring untestable code

The code is hard to test. Don't reach for mocks — that fights the symptom.
Diagnose which structural principle the code violates, fix that first, then
the tests write themselves.

## 1. Diagnose

Run down this checklist and name the violation:

- **IO interleaved with logic** — real work buried inside event handlers,
  stdin, or file reads. → Isolate side effects.
- **Raw input parsed deep inside** — every function re-validates strings and
  shapes. → Parse at the edge.
- **Implicit exceptions** — failures thrown across stack frames, invisible in
  signatures. → Model errors as values (a Result/Either type, tagged union, or
  checked error).
- **Driver/framework error types leaking** — database exceptions reaching the
  domain. → One error vocabulary per boundary.
- **Scattered steps** — the operation's failure space documented nowhere. →
  Compose in a workflow.
- **Transport codes in the domain** — HTTP statuses sprinkled through logic.
  → Map to transport once.
- **Global state** — tests leak into each other, can't run in parallel. →
  Tame global state.
- **Fat state / over-hydration** — a function or handler receives or loads
  more state than it uses (a whole `Context`, `App`, `Database`, or entity
  graph for one field), so tests must build the entire world. → Load only
  the state you need.
- **No seams** — no exported-API discipline, no way to swap a dependency. →
  Boundaries and seams.
- **Stale references / pinned objects** — code passes and caches object
  references, so a deleted entity keeps living and stale data gets served. →
  Pass identity, not references.
- **Unbounded loops / recursion / queues** — code loops or recurses with no
  limit, so a bad input hangs the process instead of failing. → Bound
  everything.
- **Branchy call sites** — a function returns a fat type the caller must
  exhaustively match, so every call site multiplies the test matrix. →
  Minimize branches at the call site.
- **Bloated interface surface** — an interface exposes too many methods or
  parameters, and its failures are undocumented. → Minimize the interface
  surface; name the fault model.
- **Hot loop doing control work** — checks and assertions inside the tight
  loop, killing performance and making the loop untestable in isolation. →
  Split the control plane from the data plane.
- **Vague names** — abbreviated or inconsistently-ordered names that blur the
  mental model. → Name for the mental model.

Pick the one doing the most damage and fix it first. Most often that's IO
interleaved with logic, raw input deep inside, or implicit exceptions.

## 2. Fix, then test

Refactor so the code follows the WRITE.md rules, preserving external
behavior. Then write the tests the new structure makes possible — see
TEST.md.

## 3. Treat pain as a signal

If a test is still painful to write after the refactor, that's not a mocking
problem — the structure still violates one of the rules above. Loop back to
step 1.
