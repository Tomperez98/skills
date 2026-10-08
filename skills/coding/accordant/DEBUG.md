# Debugging a spec

Something is red. Before changing anything, decide which of three things
happened: the spec crashed, the spec rejected a response, or the setup is
wrong. Each has a different fix, and loosening a predicate fixes none of
them. Apply the rules in order.

## 1. Name the failure before you touch code

- **The spec crashed.** `TestCaseGenerationException` during generation
  (it prints the path from the root and the state where `Apply` threw), or a
  stack trace through your `Apply` during execution. A bug in the spec.
- **The spec rejected a response.** `Allows` returned `false` with the
  explanation string of the outcome that didn't match. Either the system
  or the rule is wrong — rule 4 decides which.
- **The setup is wrong.** A compile error, a missing binding, an
  unreset system, a graph of zero or a million states. Rules 6–8.

## 2. Turn the failing case into a hand-written sequence

The failure names the sequence (the input labels, in order). Replay exactly
those calls with the `Check` helper (ORACLE.md rule 2) in a focused test. It
fails in seconds, the debugger stops in your `Apply`, and it stays as a
regression test once fixed.

## 3. A spec crash is a missing guard

The usual causes, in order of frequency:

- Indexing a dictionary before checking it exists — use `TryGetValue` and
  return a refusal outcome (SPEC.md rule 3).
- An `isTerminal` predicate that assumes the resource still exists
  (ASYNC.md rule 1).
- `StateFrozenException` — `Apply` mutated the `state` argument instead of
  the clone inside `ThenState` (SPEC.md rule 6).
- `ArgumentNullException` for `mock` — a response-aware `ThenState` without
  a mock response (SPEC.md rule 8).

A generation-only test (`spec.GenerateTests(…)` asserting a non-empty
result) finds every crash reachable from your inputs without a server.

## 4. A rejection means the spec and the system disagree — find out who's right

Read the explanation string against the actual response, then ask whoever
owns the behavior which one is correct. If the system is wrong, you found
the bug the spec exists to find; leave the spec alone. If the spec is wrong,
fix the rule — and say in the commit which rule changed and why. Common
spec-side causes: guards in a different order from the implementation, a
`.SameState()` where the operation actually changes state, a field the
predicate checks that the system never promised.

When the message starts "The system can be in more than one state", it
lists the rejection under each candidate world. If every world rejects for
the same reason, the rule is wrong; if they disagree, a read upstream didn't
narrow the profile (ASYNC.md rule 3).

## 5. Tests that pass alone and fail together are a reset problem

The spec started at `new AppState()`; the system didn't. Make
`BeforeEachAsync` delete every ID the inputs can create, or register a fresh
client against a fresh instance per test with `info.Context.Register(…)`.
Verify the reset once by reading back an empty system.

## 6. Compile and wiring errors with known causes

| Symptom | Cause |
|---------|-------|
| `CS1660: Cannot convert lambda expression to type 'ResponseValidator'` | Short-form `Expect.That(r => …)` in an inline `spec.Operation` lambda — use `Expect.That<TResp>` and `.ThenState<TState>` (SPEC.md rule 4) |
| `[State]` generator diagnostics | Class not `partial`, nested inside another type, a record/struct, or a `HashSet` / interface-typed property |
| Nested state compares or clones wrong | A nested class without its own `[State]` |
| `Execute not implemented for operation 'X'` | No binding for `X`, or a name that differs from the operation's |
| `InvalidCastException` at execution | The binding's `<TRequest, TResponse>` differs from the operation's |
| `InvalidOperationException` from `ConfigureDerivations` / `ConfigurePolling` | Called on a class-based operation — override `DerivedFrom` / `Polling` |
| `spec.Validate` doesn't exist | It never did; the docs mean `spec.Allows` |

## 7. Zero tests or too many is a graph problem

Zero test cases: the `InputSet` is empty, or `StateConstraint` rejects the
initial state. Too many, or generation never finishes: lower `MaxDepth`,
tighten `StateConstraint`, cap reuse with `MaxOperationApplicationCount`,
switch to a seeded `CreateRandomWalk`, and generate with fault outcomes off
(FAULTS.md rule 6). Visualize the graph (GENERATE.md rule 6) to see which
input multiplies the states.

## 8. Get the evidence into the test output

Every result has a `LogFilePath` with the full step log. `spec.WithJsonPrinters()`
makes requests and responses readable there. Send logs to the test runner
with `Logger.LogLambda = line => TestContext.WriteLine(line)` (or xUnit's
`ITestOutputHelper`), keep runs apart with
`Logger.AsyncLocalOutputDirectory.Value = path`, and add your own lines from
inside `Apply` with `Logger.Log(…)` when you need to see which branch ran.

---

A fix in the spec is a change to the contract: rerun the trace database
(ORACLE.md rule 7) to make sure previously valid behavior is still
accepted.
