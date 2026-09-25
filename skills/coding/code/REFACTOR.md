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
- **Ambient configuration** — functions read environment variables deep in
  the call stack, so behavior depends on process-wide state that no
  signature names; tests set and restore variables, and pass only in a
  particular order. → Configure explicitly, at the edge.
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
- **Tangled conditionals** — nested or negated conditions that re-check
  what an enclosing branch already proved, so the test matrix covers cases
  that can't happen. → Write conditions as logic.
- **Hand-rolled search or uniqueness loops** — a loop that returns on the
  first match, or skips duplicates by hand, so the invariant lives in code
  you have to test instead of in the type. → Write conditions as logic; let
  the type hold the guarantee.
- **Bloated interface surface** — an interface exposes too many methods or
  parameters, and its failures are undocumented. → Minimize the interface
  surface; name the fault model.
- **Hot loop doing control work** — checks and assertions inside the tight
  loop, killing performance and making the loop untestable in isolation. →
  Split the control plane from the data plane.
- **Speculative structure** — hierarchies, interfaces, or plugin layers
  built ahead of any concrete need, so a test has to satisfy the framework
  before it can reach the code that does the work. → Solve the problem
  before you abstract.
- **Vague names** — abbreviated or inconsistently-ordered names that blur the
  mental model. → Name for the mental model.
- **Fragile crash path** — shutdown or crash depends on the component
  cleaning itself up, and startup has a separate, untested "fresh" path. →
  Crash-only design.
- **Non-idempotent effects** — retrying an operation double-applies it, so
  recovery and retry are unsafe. → Make retryable effects idempotent.
- **Infinite waits / permanent holds** — a call blocks forever or a resource
  is never released, so a hang never becomes a fail-stop. → Timeout every
  interaction; lease every resource.

Pick the one doing the most damage and fix it first. Most often that's IO
interleaved with logic, raw input deep inside, or implicit exceptions.

## 2. Fix, then test

Refactor so the code follows the WRITE.md and CRASHONLY.md rules, preserving
external behavior. Make one behavior-preserving rewrite at a time, rewrite
conditions logically only when they're side-effect-free, and prove each
rewrite against the original (TEST.md, "Test a refactor against the
original"). Then write the tests the new structure makes possible — see
TEST.md.

## 3. Treat pain as a signal

If a test is still painful to write after the refactor, that's not a mocking
problem — the structure still violates one of the rules above. Loop back to
step 1.
