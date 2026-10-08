---
name: accordant
description: >
  Test any stateful system — any language, any transport — with Accordant
  specs. One rule: write the contract once, in the spec, and let it judge
  every response. Use when the user writes a spec, models state or
  operations, generates or runs tests, validates traces from another
  language, hunts race conditions, models async jobs, polling, timeouts, or
  retries, or debugs a failing spec — even if they never say "model-based
  testing" or "oracle".
---

# Accordant

[Accordant](https://github.com/microsoft/accordant) (`dotnet add package
Microsoft.Accordant`) is a model-based testing framework for .NET. You write
a *spec* — a minimal state plus one `Apply` per operation that says, for any
state and request, which responses are correct and how the state moves. The
spec then simulates the system, generates sequences, and validates every
real response.

The spec is written in C#, but the system under test can be anything. The
spec never talks to the system; it only judges (request, response) pairs.
How a call reaches the system is whatever the binding does: HTTP, gRPC, a
message queue, a database, a CLI process, a native library through
P/Invoke, or a plain in-process method call. If .NET can't reach the
system at all, the system records a trace in its own language and the spec
validates it afterwards (ORACLE.md). Never tell a user Accordant is only for
.NET code or only for HTTP APIs.

Everything in this skill follows from one rule:

> **Write the contract once, in the spec — and let it judge every response.**

## Pick a branch

Identify which situation you're in — from the user's prompt, the code in
front of you, or by asking if the user is around:

- **"Model this system / write a spec / add an operation"** →
  [SPEC.md](SPEC.md). Minimal state, guards in implementation order, strong
  predicates, one outcome per branch.
- **"Generate tests / run them against my API / bind the client"** →
  [GENERATE.md](GENERATE.md). Bind, reset, pick inputs, bound the graph,
  look at it, run.
- **"Validate my existing tests / traces / a system that isn't .NET"** →
  [ORACLE.md](ORACLE.md). The spec as a pure judge: `spec.Allows`, traces,
  exported test plans, a trace database for the spec itself.
- **"Find race conditions / double booking / lost updates"** →
  [CONCURRENCY.md](CONCURRENCY.md). Sequential green first, then
  linearizability over small concurrent groups.
- **"Background jobs / polling / eventual completion / server-generated IDs"**
  → [ASYNC.md](ASYNC.md). Step functions in the model, polling and
  derivations at test time, liveness as a bound.
- **"Timeouts / 500s / retries / fault injection / did it happen or not"** →
  [FAULTS.md](FAULTS.md). Every explanation of an ambiguous response is an
  outcome; the state profile carries all of them.
- **"The spec crashes / tests fail / generation explodes / it won't compile"**
  → [DEBUG.md](DEBUG.md). Decide whether the spec or the system is wrong
  before touching either.

The branches produce very different output, so getting this wrong wastes
the work. If the situation is genuinely ambiguous and the user isn't
reachable, default by what's in front of you (no spec yet or an `Apply`
being edited → SPEC; a test fixture or `InputSet` → GENERATE; a log, trace
file, or non-.NET service → ORACLE; a lock, transaction, or "sometimes
both succeed" → CONCURRENCY; a `Pending` status or a job table → ASYNC; a
retry loop or fault proxy → FAULTS; a red test or a stack trace → DEBUG)
and state the assumption at the top of your work.

## The one rule

**Write the contract once, in the spec — and let it judge every response.**

- **Once.** Business rules live in `Apply` and nowhere else. A test is just
  a sequence of calls; it carries no assertions about balances, status
  codes, or IDs. When the contract changes, one `Apply` changes and every
  sequence — generated, hand-written, replayed — is judged by the new rule.
- **The spec judges.** `Apply` never calls the system and `Execute` never
  decides correctness. That split is what lets the same spec drive
  generation (simulate `Apply`), execution (bind `Execute`), and trace
  validation (`spec.Allows`, no execution at all). A predicate only judges
  what it checks, so check the payload, not just the status.
- **Every response.** Errors, exceptions, timeouts, concurrent interleavings,
  and background completions are all responses the spec must explain. When
  more than one world is consistent with what was observed, the spec lists
  every one (`Expect.OneOf`, step functions) and lets later observations
  eliminate the impossible ones — it never guesses.

Start partial: two to four related operations, the happy path and one error
each, then strengthen. The `code` skill's rule holds inside the spec too: a
`KeyNotFoundException` in `Apply` is a bug in the spec, so guard every
lookup; an expected refusal (404, 409, a thrown domain exception) is an
outcome you declare, never a crash you tolerate.
