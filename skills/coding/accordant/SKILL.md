---
name: accordant
description: >
  Specify and test any stateful system — any language, any transport —
  with Accordant. One rule: write the contract once, in the spec, and let
  it judge every response. Use when the user models a system, generates or
  runs tests, validates traces from another language, hunts races, models
  async jobs, polling, timeouts, retries, checks backward compatibility,
  or changes or debugs a spec — even if they never say "model-based
  testing" or "oracle".
---

# Accordant

[Accordant](https://github.com/microsoft/accordant) (`dotnet add package
Microsoft.Accordant`) is a model-based testing framework for .NET. You write
a _spec_ — a minimal state plus one `Apply` per operation that says, for any
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

Writing a spec is not writing the system again. The system decides _how_
to produce one response; the spec decides _which_ responses are correct,
and is simpler than the system so it can be checked by reading it against
the contract. Its rules come from the contract — docs, tickets, whoever
owns the behavior — not from the code, or it agrees with every bug.

Everything in this skill follows from one rule:

> **Write the contract once, in the spec — and let it judge every response.**

## Pick a branch

Identify which situation you're in — from the user's prompt, the code in
front of you, or by asking if the user is around:

- **"Model this system / write a spec / add an operation"** →
  [SPEC.md](SPEC.md). The contract, not a second implementation: minimal
  state, guards in the contract's order, strong predicates, one outcome per
  branch.
- **"Generate tests / run them against my API / bind the client"** →
  [GENERATE.md](GENERATE.md). Bind, reset, pick inputs, bound the graph,
  look at it, run.
- **"Validate my existing tests / traces / a system that isn't .NET"** →
  [ORACLE.md](ORACLE.md). The spec as a pure judge: `spec.Allows`, traces
  from any language, concurrent segments, exported test plans, events.
- **"Find race conditions / double booking / lost updates"** →
  [CONCURRENCY.md](CONCURRENCY.md). Sequential green first, then
  linearizability over small concurrent groups; pin each race as a case.
- **"Background jobs / polling / eventual completion / server-generated IDs"**
  → [ASYNC.md](ASYNC.md). Step functions in the model, polling and
  derivations at test time, liveness as a bound, polling off to act
  mid-job.
- **"Timeouts / 500s / retries / fault injection / did it happen or not"** →
  [FAULTS.md](FAULTS.md). Every explanation of an ambiguous response is an
  outcome; the state profile carries all of them.
- **"Is the new version backward compatible / check against the last release"**
  → [BASELINE.md](BASELINE.md). The released spec and sequences, unchanged,
  judge the new build through a client as strict as the promise; the
  upgrade runs over data the old build wrote; traces from the release
  replay under main's spec.
- **"I changed the spec — is it still right? / review this spec change /
  would the spec catch a wrong answer?"** → [TRACES.md](TRACES.md). A trace
  database replayed on every spec change, mutated traces the spec must
  reject, every outcome exercised, the spec diff posted as a contract
  change.
- **"The spec crashes / tests fail / generation explodes / it won't compile"**
  → [DEBUG.md](DEBUG.md). Decide whether the spec or the system is wrong
  before touching either.

The branches produce very different output, so getting this wrong wastes
the work. If the situation is genuinely ambiguous and the user isn't
reachable, default by what's in front of you (no spec yet or an `Apply`
being edited → SPEC; a test fixture or `InputSet` → GENERATE; a log, trace
file, or non-.NET service → ORACLE; a lock, transaction, or "sometimes
both succeed" → CONCURRENCY; a `Pending` status or a job table → ASYNC; a
retry loop or fault proxy → FAULTS; a release tag or baseline suite →
BASELINE; a spec diff under review or a trace database → TRACES; a red
test or a stack trace → DEBUG) and state the assumption at
the top of your work.

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

## Where it pays off, and in what order

Accordant earns its keep where correct behavior is hard to write down one
test at a time: sequences where an earlier call changes what a later one
must return, races, background work, and failures that may or may not
have taken effect. Adopt the branches in that order of payoff, and stop
where the system stops needing them:

1. **SPEC + GENERATE** on one stateful cluster of operations. This alone
   catches the orderings nobody writes by hand.
2. **CONCURRENCY, FAULTS, ASYNC** only where races, timeouts, or jobs
   actually bite. These find bugs hand-written tests almost never reach.
3. **BASELINE** once something outside the team depends on the behavior.
4. **TRACES** last, once the spec is long-lived and others rely on it.
   Before that, the trace database is ceremony.

The judge is only as strict as its predicates, and only as thorough as
its `InputSet` and `MaxDepth`: an unchecked field or an unreached path is
untested. The library is young (0.1.x) — some public options do nothing
and some APIs compile but aren't wired in (DEBUG.md rule 6) — so check a
surprising behavior against the source before blaming the spec.

Start partial: two to four related operations, the happy path and one error
each, then strengthen. The `code` skill's rule holds inside the spec too: a
`KeyNotFoundException` in `Apply` is a bug in the spec, so guard every
lookup; an expected refusal (404, 409, a thrown domain exception) is an
outcome you declare, never a crash you tolerate.

## Hand off

When the task crosses into another skill's ground, load it with the Skill
tool rather than carrying on from memory:

- **A rejection is a real bug in the system** → call the Skill tool with
  "code" and follow WRITE.md or REFACTOR.md to fix the system, not the spec.
- **Running the spec on every merge or against the last release** → call
  the Skill tool with "ship" and follow CI.md or COMPAT.md.
