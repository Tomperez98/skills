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
case is a sequential prefix followed by a group that runs concurrently.
`MaxConcurrencyLevel` (default 3) caps the group size; raising it grows the
check factorially, so raise it only with a reason.

## 5. Read "no linearization" as a list of broken promises

A failure lists each ordering the checker tried and what the spec expected
under it ("if Alice first, Bob should get 409"). That list is the bug
report. The fix belongs in the implementation — a serializable transaction,
a lock around the critical section, optimistic concurrency with a row
version — then rerun the same concurrent cases.

## 6. One green run is not proof

Interleavings depend on timing, so a race can hide for a run or ten. Run
concurrent suites repeatedly (a loop in the test, or a scheduled CI job;
COMPAT.md rule 6 adds the last release's spec as a second judge).
A concurrent case that fails intermittently is most likely the race you're
hunting, not a flaky test — rule out an incomplete reset first, then treat
it as a bug.

---

ORACLE.md rule 4 applies the same check to concurrent traces recorded
outside .NET. When a failed call might still have taken effect, FAULTS.md
adds that possibility to the spec.
