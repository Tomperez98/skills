# CODE.md

These rules are language-, framework-, and tool-agnostic. Examples are pseudocode, so translate the shape to the project's stack, and let repo conventions decide mechanics. If a skill or process framework is available, it owns the workflow. Apply these rules inside each step. On conflict, these rules win. Say so when you override one.

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

## Conditions and decisions
- Rewrite conditions with logic rules (De Morgan, distribution, double negation), one rule per step. Only do this when the clauses are pure: short-circuiting and mutation break the algebra. Inside `if P`, don't re-check `P`.
- Write search loops as `any`/`all`. Merge quantifiers into one pass and hoist terms that don't depend on the loop variable. Express implication as a filter: `all(Q(x) for x in xs if P(x))`.
- For a decision over several inputs, write a table first (inputs as columns, `-` for "doesn't matter"). Check it's complete (rows cover every combination, so count them) and unambiguous (no overlaps). Ask about gaps; don't guess.
- Test the table: one case per row, plus one test that enumerates every input combination and asserts exactly one row matches.
- Prove each rewrite against the original. Enumerate the truth table for small Boolean domains, use random inputs as an oracle for large ones, and compare recorded side-effect sequences, not just values. Delete the old version once the change lands.

## State and configuration
- Prefer a config option with a visible default over a global, so tests override it without touching process-wide state.
- Read the environment once, at the edge (`main` or the CLI parser), into a typed value. No `getenv` below that line. The parser takes `env` as a parameter.
- Every config value is required. A missing or malformed value fails at startup and names the variable. Never fall back to a dev default.
- Give each function the narrowest slice it uses (a `DbUrl`, not `Config` or `App`), one hop deep: no `order.customer.account.address.city` (Law of Demeter). In a request, load only the rows it reads.
- Pass and cache IDs across boundaries, not hydrated objects. Version mutable things (etag, row version) so a stale write fails loudly (404/409).
- Declare data invariants in the store (`NOT NULL`, `UNIQUE`, `CHECK`, FKs). An app-side check is only for friendlier errors. Map violations once: user-causable ones are expected errors, code-only ones are bugs. Test each constraint by writing the bad row with raw SQL.

## Crash-only design
Name the stop mechanism first: synchronous cancellation (unwind), asynchronous cancellation (request, wait for ack, then release, with a lease on the ack), graceful shutdown, or crash.
- One stop path (crash) and one start path (recovery). If the component survives `kill -9`, a graceful shutdown path is dead code. Startup is recovery and runs on every boot. Don't write a separate fresh-install path.
- Nothing must happen at shutdown. Recovery rebuilds every invariant from durable state. Never read state a crash left half-written (poisoned locks, partially filled buffers).
- Make every retryable effect idempotent (idempotency key or sequence number). Mark non-idempotent ones loudly and compensate instead of retrying.
- A unit of work carries everything a fresh instance needs to resume it, or an ID that re-resolves it.
- Every call has a timeout and every lock, claim, or allocation has an expiring lease. A timeout means "assume the peer is dead": report it to the supervisor.
- Keep durable state in a crash-safe, fast-recovering store, and keep the component stateless. Use the weakest store semantics that suffice.
- Cap retries, use exponential backoff, and add jitter. Crash-reboot components on stall or exhaustion symptoms before they fail. Quiesce new work during recovery.

## Performance
- At design time, before there's anything to profile, write a back-of-the-envelope sketch over network, storage, memory, and compute, each for bandwidth and latency. Name the bottleneck.
- Split the control plane from the data plane. Validate and assert once per batch, then run a branch-free loop over the data.
- CPU-bound hot loops (only when a profiler names them): smaller types and packed structs, sequential access, struct-of-arrays, contiguous arrays over linked structures, static over dynamic dispatch, zero copy, cache-line-aligned fixed-size structs.

## Tests
- Assert the variant before the payload. Write one test per error variant, with its payload.
- Test short-circuiting: record calls and assert later steps did NOT run after an early failure.
- Test retries deterministically: inject the operation, use zero delay, and assert the exact attempt list.
- Defects panic and expected failures return: assert a crash with the framework's should-panic/throw assertion, and assert an expected failure on the returned variant. Generate only inputs that satisfy the precondition.
- Test helpers crash on failure instead of returning Results.
- Pass config as a value. Never mutate env vars or process-wide state in tests. Test the env-to-config seam by passing `env` as a map. Each test owns its state and runs in any order. Name the suite's wall-clock budget.
- Expect/snapshot tests: render a small, deterministic, human-readable story, not a dump. Keep it next to the test, with several expectations per scenario. Normalize IDs, timestamps, and ordering. A change that rewrites hundreds of expectations is too big to review: split it or assert the contract.
- Pin important signatures with a compile-time type assertion.
- Property tests for contracts: postcondition/invariant, round-trip (`parse(render(x)) == Ok(x)`), oracle, split/combine (assert the empty case: `all([])` is true), simulated clock and network, and the same suite against every implementation. Generators include empty, single, duplicate, and boundary inputs. Keep each shrunk counterexample as an example test. Fix or log the seed.
- Kill a mutant. Unit tests: a mechanical mutation. System/property tests: a semantic bug that is reached (e.g. restore an older snapshot). Only "caught at the broken assertion" counts. "Never ran" is inconclusive, and "ran unnoticed" means strengthening the test. Keep the budget small, and revert every mutant before committing.
- Crash tests: kill mid-write without cleanup, restart, and assert the state is rebuilt or dropped, never corrupt. Apply an idempotent operation twice and assert one effect. Assert the worker's ack precedes the release on async cancellation.

## Dependencies
- Count the transitive tree before adding a dependency and state the choice: write it, depend on it, or fork it. Write small helpers yourself. Depend on mid-size libraries, and fork-and-trim only with the user's OK. Always depend on crypto, protocols, and heavy frameworks; never roll your own.
- Pin exact versions in the manifest too. No floating ranges (`^1.2`). Vendor forks in-repo.
- Every update has a stated reason (security fix, user-hit bug, needed feature, toolchain reach). A bot PR is a proposal. Batch bot PRs weekly per ecosystem. A patch whose boundary tests stay green may auto-merge; everything else waits for a person.
- Review in proportion to risk, and state what you reviewed and what you didn't. If you can't trust an update, take the minimum version with the fix.
- Wrap each dependency behind one module. It maps the dependency's errors into your vocabulary, parses its output, and panics on contract-violating output. Test that boundary against the outputs you parse and the errors you map.

## HTTP APIs
Ask the user when the protocol, versioning scheme, or auth model is their call.
- Default to REST. Use GraphQL when several clients need different subsets and over/under-fetching is measured. Use gRPC for service-to-service actions, generated clients, or streams. One protocol per boundary.
- Required relationships go in the path and optional filters in the query. An action is a resource (`POST /bookings/{id}/cancellation`).
- Every request is self-contained. No server memory between requests. Long work becomes a resource (`GET /jobs/{id}`).
- Prefer cursor pagination when rows are inserted while clients page or the collection is large. Sort by a unique tiebreaker. Use a server default and a hard max limit. Allowlist filter and sort field names and map them to storage yourself.
- Error `code` values are part of the contract. Clients branch on `code`, never `message`, and fall back to the status class for unknown codes. There's one generic 5xx code and no internals.
- Version explicitly from the first release (`/v1` unless URLs must stay stable). Clients ignore unknown fields. Adding an enum value, adding a required param, or changing meaning or units is breaking. Serve the old version alongside the new one with a stated sunset.
- Cap request body size as well as page size.
