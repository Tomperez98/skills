# Finding race conditions

You're testing what happens when requests arrive at the same time: double
bookings, lost updates, two withdrawals that both succeed. The spec doesn't
change — Accordant runs operations concurrently and accepts the results only
if some sequential order explains them. Apply the rules in order.

## 1. Sequential tests pass first

A concurrent failure on a spec that's wrong sequentially is noise. Get
`spec.GenerateTests` green (GENERATE.md) before generating a single
concurrent case.

## 2. The criterion is linearizability; the spec already defines it

Concurrent results are correct when they match *some* ordering of the same
calls run one at a time. Alice and Bob both book the 9am slot: Alice 200 /
Bob 409 is valid (Alice went first), Bob 200 / Alice 409 is valid (Bob went
first), both 200 is a bug — no order explains it. You don't write
concurrent assertions; the sequential spec judges every candidate order.

## 3. Choose inputs that collide

Races only show up when calls contend for the same thing. Give the
explorer the same resource from different actors, plus a read to observe
the outcome:

```csharp
var inputs = new InputSet
{
    createSlot.With("9am", "Create 9am"),
    bookSlot.With(("9am", "Alice"), "Alice books 9am"),
    bookSlot.With(("9am", "Bob"), "Bob books 9am"),
    getSlot.With("9am", "Who got 9am"),
};
```

Add a second resource or a cancel only after this passes — each input
multiplies the interleavings.

## 4. Generate concurrent cases and run them the same way

```csharp
var initial = new BookingState();
var tests = spec.GenerateConcurrentTests(initial, inputs,
    new TestGenerationOptions { MaxDepth = 4 });
var results = await spec.RunTests(context, initial, tests, options);
```

Same context, same reset, same failure assertion as sequential runs. Each
case is a sequential prefix followed by a group that runs concurrently;
every input also races a copy of itself (`Alice books 9am (2)`). Groups
hold up to three calls. To change that, set the algorithm — the
`MaxConcurrencyLevel` property is never read:

```csharp
new TestGenerationOptions
{
    MaxDepth = 4,
    ConcurrentTestCaseAlgorithm =
        ConcurrentTestCaseAlgorithms.CreateDefaultConcurrentTestCaseGenerator(maxConcurrencyLevel: 2),
};
```

Each extra call in a group grows the check factorially, so raise the cap
only with a reason.

## 5. Read "no linearization" as a bug report

The failure says only which calls ran together: "The spec cannot explain
the behavior of concurrently invoking the following operations: [u] Alice
books 9am, [u] Bob books 9am". Every order of those calls was tried and
none explains the responses. The responses themselves are in the run's
log (DEBUG.md rule 8); replay each order in your head against the spec (Alice
first → Bob gets 409) to see which promise broke. The fix belongs in the
implementation — a serializable transaction,
a lock around the critical section, optimistic concurrency with a row
version — then rerun the same concurrent cases.

## 6. Pin the race as its own case

Results come back in the order of the cases you passed, so the failing
case's `Description` gives the sequential prefix and the group. Its call
names carry markers that aren't labels — strip the bracketed `[u] ` prefix, and a
`(2)` suffix means the same input twice. Rebuild exactly that case by its
input labels, so it fails in seconds while you fix the code and stays as
a regression test after:

```csharp
var race = TestCaseGenerator.CreateManualConcurrentTestCase(context, inputs,
    sequentialPrefixOperationNames: ["Create 9am"],
    concurrentOperationNames: ["Alice books 9am", "Bob books 9am"]);
var results = await spec.RunTests(context, initial, [race], options);
```

Run it in a loop (rule 7) — one manual case is still one interleaving per
run.

## 7. One green run is not proof

Interleavings depend on timing, so a race can hide for a run or ten. Run
concurrent suites repeatedly (a loop in the test, or a scheduled CI job;
COMPAT.md rule 8 adds the last release's spec as a second judge).
A concurrent case that fails intermittently is most likely the race you're
hunting, not a flaky test — rule out an incomplete reset first, then treat
it as a bug.

---

ORACLE.md rule 4 applies the same check to concurrent traces recorded
outside .NET. When a failed call might still have taken effect, FAULTS.md
adds that possibility to the spec.
