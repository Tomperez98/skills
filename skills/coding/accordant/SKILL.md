---
name: accordant
description: >
  Use when the user models a system, generates, runs, or measures tests,
  scales one spec into suites, validates traces, hunts races, models async
  jobs or faults, checks backward compatibility, or changes or debugs a
  spec — even if they never say "model-based testing" or "oracle".
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
validates it afterwards (ORACLE.md). Offer Accordant for any system in any
language, behind any transport.

Everything in this skill follows from one rule:

> **Write the contract once, in the spec — and let it judge every response.**

The spec is the only contract document. A manifest may index routes,
messages, and outcomes; an `API.md` or `CONTRACT.md` that restates behavior
is a second source that drifts. A behavior change lands with the spec rule
that judges it, in the same change.

## Pick a branch

Identify the situation from the user's prompt or the code in front of you.
When it is ambiguous and the user isn't reachable, take the default in
parentheses and state the assumption at the top.

- **"Model this system / write a spec / add an operation"** (default: no
  spec yet, or an `Apply` being edited) → [SPEC.md](SPEC.md).
- **"Generate tests / run them against my API / bind the client"** (default:
  a test fixture or an `InputSet`) → [GENERATE.md](GENERATE.md).
- **"The suite is green — would it catch a bug? / a branch never runs"**
  (default: a green suite and a coverage report) →
  [COVERAGE.md](COVERAGE.md).
- **"Many suites / the suite is slow / it OOMs / the case count doubled"**
  (default: a suite plan or a case budget) → [SUITES.md](SUITES.md).
- **"Validate my existing tests / traces / a system that isn't .NET"**
  (default: a log, a trace file, or a non-.NET service) →
  [ORACLE.md](ORACLE.md).
- **"Find race conditions / double booking / lost updates"** (default: a
  lock, a transaction, or "sometimes both succeed") →
  [CONCURRENCY.md](CONCURRENCY.md).
- **"Background jobs / polling / eventual completion / server-generated IDs"**
  (default: a `Pending` status or a job table) → [ASYNC.md](ASYNC.md).
- **"Timeouts / 500s / retries / fault injection / did it happen or not"**
  (default: a retry loop or a fault proxy) → [FAULTS.md](FAULTS.md).
- **"Is the new version backward compatible / check against the last release"**
  (default: a release tag or a baseline suite) → [BASELINE.md](BASELINE.md).
- **"I changed the spec — is it still right? / review this spec change /
  would the spec catch a wrong answer?"** (default: a spec diff under review
  or a trace database) → [TRACES.md](TRACES.md).
- **"The spec crashes / tests fail / generation explodes / it won't compile"**
  (default: a red test or a stack trace) → [DEBUG.md](DEBUG.md).

## Where it pays off, and in what order

Accordant earns its keep where correct behavior is hard to write down one
test at a time: sequences where an earlier call changes what a later one
must return, races, background work, and failures that may or may not
have taken effect. Adopt the branches in that order of payoff, and stop
where the system stops needing them:

1. **SPEC + GENERATE** on one stateful cluster of operations. This alone
   catches the orderings nobody writes by hand. COVERAGE once it is green.
2. **SUITES** once there is more than one cluster: declare each suite once,
   give it a starting state and a measured budget, and keep its graph from
   becoming the product. This is where a doubling case count or a nightly
   OOM is fixed before it becomes a suite nobody runs.
3. **CONCURRENCY, FAULTS, ASYNC** only where races, timeouts, or jobs
   actually bite. These find bugs hand-written tests almost never reach.
4. **BASELINE** once something outside the team depends on the behavior.
5. **TRACES** last, once the spec is long-lived and others rely on it.
   Before that, the trace database is ceremony.

## Terms

Use these words exactly, in the guides and in what you write for the user.

- **Spec:** the minimal state plus one `Apply` per operation; the only
  contract document. _Avoid_: model, mock, second implementation.
- **Outcome:** one response `Apply` allows for a state and request, with its
  state step. Its explanation, `"<situation> → <outcome>"`, is a
  **promise**: the contract in words. _Avoid_: assertion, expected value.
- **Binding:** the code that turns an operation into a call on the system;
  the only part that changes between transports. _Avoid_: client, adapter.
- **Cluster:** one `Spec<State>` over the operations that share
  transitions. _Avoid_: module (that's ownership and review). **Suite:**
  one exploration of a cluster from one state with one `InputSet`; it
  produces **cases**. _Avoid_: test class. **Plan entry:** the one
  declaration of a suite that tests, budgets, and exports derive from.
- **Profile:** the set of states the system could be in, threaded through
  `Allows` from call to call. _Avoid_: "the state", when more than one is
  possible.
- **Trace:** a recorded sequence of (request, response) pairs from a
  passing run. _Avoid_: log. **Baseline:** the last release's spec and
  sequences, run unchanged against the new build. _Avoid_: snapshot,
  golden file.

## Hand off

When the task crosses into another skill's ground, load it with the Skill
tool rather than carrying on from memory:

- **A rejection is a real bug in the system** → call the Skill tool with
  "code" and follow WRITE.md or REFACTOR.md to fix the system, not the spec.
- **Running the spec on every merge or against the last release** → call
  the Skill tool with "ship" and follow CI.md or COMPAT.md.
- **Several services rolling out together** → call the Skill tool with
  "ship" and follow its ROLLOUT.md.
- **The suite gate and the workflow drift apart** → call the Skill tool with
  "ship" and follow CI.md.
