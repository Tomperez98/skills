# Debugging a spec

Something is red. Before changing anything, decide which of three things
happened: the spec crashed, the spec rejected a response, or the setup is
wrong. Each has a different fix, and loosening a predicate fixes none of
them. Apply the rules in order.

## 1. Name the failure before you touch code

- **The spec crashed.** `TestCaseGenerationException` during generation
  (it prints the path from the root and the state where `Apply` threw; the
  original exception is its `InnerException`), or a
  stack trace through your `Apply` during execution. A bug in the spec.
- **The spec rejected a response.** `Allows` returned `IsValid: false`, its
  `Message` the explanation string of the outcome that didn't match. Either the
  system or the rule is wrong — rule 4 decides which.
- **The setup is wrong.** A compile error, a missing binding, an
  unreset system, a graph of zero or a million states. Rules 5–8.

## 2. Turn the failing case into a hand-written sequence

`LastFailureMessage` names only the failing call. The sequence is the
case's `Description` — `tests[i]` for a failing `results[i]`, or the
"Executing …" line in the log — in simplified call names (`[u] X` when an
input repeats, `(A -> B)` for a derived call); map them back to input
labels. Replay exactly
those calls with the `Check` helper (ORACLE.md rule 2) in a focused test. It
fails in seconds, the debugger stops in your `Apply`, and it stays as a
regression test once fixed. A failing concurrent case is rebuilt the same
way with `CreateManualConcurrentTestCase` (CONCURRENCY.md rule 6).

Shrink a long case before you read it; Accordant doesn't. Drop one call
at a time and keep any shorter case that still fails. Dropping a call is
safe: the spec judges the shorter case on its own terms, so a Create
that's gone turns a later Get into a 404 it expects.

```csharp
async Task<bool> Fails(List<OperationCall> calls) =>
    !(await spec.RunTests(context, initial, [new SequentialTestCase
    {
        Description = TestCaseGenerator.ConstructDescriptionForSequentialTestCase(calls),
        OperationCalls = calls,
    }], options))[0].Success;

var calls = tests[i].OperationCalls.ToList();
for (var j = calls.Count - 1; j >= 0; j--)
{
    var shorter = calls.Where((_, k) => k != j).ToList();
    if (await Fails(shorter)) calls = shorter;
}
```

Keep the source of a derived call (GENERATE.md rule 9), and check that the
shorter case still fails with the same message — a different failure is a
different bug.

## 3. A spec crash is a missing guard

The usual causes, in order of frequency:

- Indexing a dictionary before checking it exists — use `TryGetValue` and
  return a refusal outcome (SPEC.md rule 3).
- An `isTerminal` predicate that assumes the resource still exists
  (ASYNC.md rule 1).
- `StateFrozenException` — `Apply` mutated the `state` argument instead of
  the clone inside `ThenState` (SPEC.md rule 6).
- `ArgumentNullException` for `mock` — a response-aware `ThenState` passed
  `mock: null`; give it a plausible response (SPEC.md rule 8). Leaving
  `mock` out entirely doesn't compile (`CS1593`).

A generation-only test (`spec.GenerateTests(…)` asserting a non-empty
result) finds crashes reachable from your inputs, without a server. It
finds every one only on a space explored to the end (`MaxDepth = -1`
under a `StateConstraint`, GENERATE.md rule 5); with a depth bound,
exploration can skip states within it.

## 4. A rejection means the spec and the system disagree — find out who's right

Read the explanation string against the actual response, then ask whoever
owns the behavior which one is correct. If the system is wrong, you found
the bug the spec exists to find; leave the spec alone. If the spec is wrong,
fix the rule — and say in the commit which rule changed and why. Common
spec-side causes: guards in a different order from the implementation, a
`.SameState()` where the operation actually changes state, a field the
predicate checks that the system never promised.

When the explanation says "The system can be in more than one possible state"
(from `spec.Allows`, the message starts "The system can be in more than one
state"; from `RunTests`, the state reads "Multiple possible states"), it lists
the rejection under each candidate world. If every world rejects for the same
reason, the rule is wrong; if they disagree, a read upstream didn't narrow the
profile (ASYNC.md rule 3).

## 5. Tests that pass alone and fail together are a reset problem

The spec started at `new AppState()`; the system didn't. Make
`BeforeEachAsync` delete every ID the inputs can create, or register a fresh
client against a fresh instance per test with `info.Context.Register(…)`.
Verify the reset once by reading back an empty system.

## 6. Compile and wiring errors with known causes

| Symptom | Cause |
|---------|-------|
| `CS0411: The type arguments for method 'Expect.That<TResponse>(…)' cannot be inferred` | Short-form `Expect.That(r => …)` in an inline `spec.Operation` lambda — use `Expect.That<TResp>` and `.ThenState<TState>` (SPEC.md rule 4) |
| `[State]` generator diagnostics (`STATE0xx`) | Class not `partial`, nested, abstract, a record/struct; or a property that's a `HashSet`, interface-typed, a field, `init`, getter-only of a mutable type, `required`, or a multidimensional array (SPEC.md rule 2) |
| `STATE003` unsupported type on a nested property | The nested class has no `[State]` of its own |
| `Execute not implemented for operation 'X'` | `X` has no binding |
| `SpecException: No operation with name X has been registered` | A binding or `GetOperation` names an operation that doesn't exist — usually a typo |
| `InvalidCastException` from `Bind` / `GetOperation` | The `<TRequest, TResponse>` you passed differs from the operation's |
| `TestCaseGenerationException` wrapping `InvalidCastException` from `Unit` to `String` (at execution for a manual case) | `op.With("alice")` on a `string`-request operation picked the label-only overload — pass a label too: `op.With("alice", "Get alice")` |
| `InvalidOperationException` from `ConfigureDerivations` / `ConfigurePolling` | Called on a class-based operation — override `DerivedFrom` / `Polling` |
| Setting `MaxConcurrencyLevel` changes nothing | Accordant never reads it — set `ConcurrentTestCaseAlgorithm` (CONCURRENCY.md rule 4) |
| `TestCaseGenerationException` wrapping `KeyNotFoundException` from `DerivationSources`, or `OperationValidationException: …only single-source derivations…` | A multi-source `Derive.From(a, b)` — only the first source is ever passed; resolve the second in the binding (GENERATE.md rule 9) |
| A 429 isn't retried | The spec rejected it before `ShouldRetry` ran — declare it as an outcome (FAULTS.md rule 8) |
| `spec.Validate` doesn't exist | It never did; the docs mean `spec.Allows` |

## 7. Zero tests or too many is a graph problem

Zero test cases: the `InputSet` is empty, `StateConstraint` rejects the initial
state, `ShouldApply` refuses every input, or `MaxDepth` is 1 — it counts states
with the root as 1, so a case has at most `MaxDepth − 1` calls. Generation never
finishes: the graph is too big. Tighten `StateConstraint`, cap reuse with
`MaxOperationApplicationCount`, narrow derived requests with
`DerivationSelectors`, generate with fault outcomes off (FAULTS.md rule 6), and
only then lower `MaxDepth` — it drops states silently, and not only the deepest
(GENERATE.md rule 5). The graph is finished but yields too many cases: switch
the algorithm to a seeded `CreateRandomWalk` (GENERATE.md rule 7). It walks the
finished graph, so it doesn't speed up exploration. Visualize the graph
(GENERATE.md rule 6) to see which input multiplies the states.

## 8. Get the evidence into the test output

Every result's `LogFilePath` is the run's log folder (`Logger.OutputDirectory`,
shared by every test), holding `test-runner.txt` with every step;
`spec.WithJsonPrinters()` makes requests and responses readable there —
except that it fails any test whose response is an exception
(`Expect.Throws`, which `System.Text.Json` can't serialize), and prints
tuple requests as `{}`. Once you
replace `Logger.LogLambda`, lines go to your lambda instead. Send logs to the
test runner with `Logger.LogLambda = line => TestContext.WriteLine(line)` (or
xUnit's `ITestOutputHelper`), keep runs apart with
`Logger.AsyncLocalOutputDirectory.Value = path`, and add your own lines from
inside `Apply` with `Logger.Log(…)` when you need to see which branch ran.

---

A fix in the spec is a change to the contract: replay the trace database
(TRACES.md rule 5) to make sure previously valid behavior is still
accepted, and post the change for review (TRACES.md rule 9).
