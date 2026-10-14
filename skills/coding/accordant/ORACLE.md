# The spec as oracle

You're using the spec as a judge only: something else decides which calls
to make — hand-written scenarios, a fuzzer, production logs, a test runner
in another language — and the spec says whether every response was
correct. No bindings, no built-in runner. Apply the rules in order.

## 1. The oracle is one call; thread the profile through it

```csharp
var profile = new StateProfile(new BankState());
var (isValid, message, next) = spec.Allows(withdrawOp, request, response, profile);
```

`Allows` runs `Apply` against every state the system could be in, keeps the
ones that explain the response, and returns them as the next profile. Always
carry `next` into the following call — validating each step against a
fresh state judges it against the wrong world. `message` is the spec's
explanation when nothing matches. There is no `spec.Validate`; some docs
show one, but `Allows` is the API.

## 2. Hand-written tests become sequences

A traditional test repeats business rules in its asserts. Replace every
assert with one helper, and reset the model together with the system:

```csharp
var profile = new StateProfile(new BankState());
void Check<TReq, TResp>(Operation<TReq, TResp, BankState> op, TReq req, object resp)
{
    var (ok, msg, next) = spec.Allows(op, req, resp, profile);
    Assert.That(ok, Is.True, msg);
    profile = next;
}

async Task Reset()
{
    await client.DeleteAccount("alice");
    profile = new StateProfile(new BankState());
}

await Reset();
Check(createOp, new CreateAccountRequest("alice"), await client.CreateAccount("alice"));
Check(withdrawOp, new WithdrawRequest("alice", 100m), await client.Withdraw("alice", 100m));
```

The scenario now says only *what to run*. When a rule changes, the spec
changes and every scenario follows.

## 3. Validate traces from any language

The system can be Go, Python, Rust — the spec only needs to see what
happened. Have the system emit one entry per call (operation name, request
JSON, response JSON), then walk it:

```csharp
var profile = new StateProfile(new BankState());
foreach (var (entry, i) in trace.Select((e, i) => (e, i)))
{
    var op = spec.GetOperation(entry.Operation);
    var req = JsonSerializer.Deserialize(entry.Request.GetRawText(), op.RequestType);
    var resp = JsonSerializer.Deserialize(entry.Response.GetRawText(), op.ResponseType);

    var (ok, msg, next) = spec.Allows(op, req, resp, profile);
    if (!ok) throw new Exception($"Violation at step {i} ({entry.Operation}): {msg}");
    profile = next;
}
```

The trace's operation names must match the spec's exactly, its JSON must
deserialize into the spec's request and response types, and the system must
really be in the initial state when the trace starts — reset it in tests,
or start a production trace from a snapshot.

Record the raw request and response, IDs and timestamps included. A value
that differs on every run isn't noise to scrub: either the spec captures it
and holds later steps to it (SPEC.md rule 8), or the spec leaves it out
(SPEC.md rule 9) and it costs nothing — scrubbing only loses evidence, and
a placeholder can break the capture. Give each trace a header naming where
it started (a reset or a snapshot), the spec version that accepted it, and
whether failure outcomes were enabled (FAULTS.md rule 6) — replay with the
same setting, or every timeout in a fault run reads as a violation. A trace
that no longer deserializes into the spec's types is a shape break, not a
rejection — report it apart from the spec's verdicts.

## 4. Group concurrent calls only when they truly overlapped

Calls that ran at the same time go to `AllowsConcurrent`, which accepts the
results if *some* sequential order explains them:

```csharp
var calls = group.Select(e =>
{
    var op = spec.GetOperation(e.Operation);
    return ((IOperation)op,
            JsonSerializer.Deserialize(e.Request.GetRawText(), op.RequestType),
            JsonSerializer.Deserialize(e.Response.GetRawText(), op.ResponseType));
}).ToList();

var (ok, msg, next) = spec.AllowsConcurrent(profile, calls);
```

Put a call in a group only if its time window overlapped the others; a call
that finished before another started stays sequential, or pass the ordering
as `happensBefore` edges `(before, after)`. Over-grouping hides real
violations, and cost grows factorially with group size — keep groups to a
handful of calls.

The flat trace of rule 3 can't say which calls overlapped, so write
concurrent traces as segments: one entry is a sequential step, several
entries overlapped and go to `AllowsConcurrent` together. Under
`spec.RunTests` the runner already knows: `OnStepExecuted` reports a
concurrent batch as `info.Operations` — write that batch as one segment. A
system recording its own trace logs each call's start and end time and
builds segments from them.

```json
[
  [{ "operation": "CreateAccount", "request": {}, "response": {} }],
  [{ "operation": "Withdraw", "request": {}, "response": {} },
   { "operation": "Withdraw", "request": {}, "response": {} }]
]
```

## 5. Export test plans for a runner in another language

The spec can still choose the sequences even when .NET doesn't run them:

```csharp
var context = spec.CreateTestingContext();
var tests = spec.GenerateTests(new BankState(), inputs, gen);
TestCaseGenerator.SaveSequentialTestCases(context, "test-cases.json", tests);
```

Each case lists `OperationCalls` with `Input.OperationName` and
`Input.SerializedRequest`; concurrent cases use `Segments`. Your runner
resets the system, executes each call, records the trace, and feeds it back
through rule 3. When `DerivedFromOperationCalls` is set, `SerializedRequest`
is `null` — build the request from the named earlier response. When
`Polling` is set and `SkipPolling` isn't, poll the named operation until
done. Need the raw graph instead? `TestCaseGenerator.ExploreStateSpace(…)`
returns the root `StateGraphNode` to walk however you like.

## 6. Events are requests with an empty response

A system that emits events (webhooks, messages) fits the same shape: model
each event as an operation whose request is the event and whose response is
`Unit`. The spec then checks that each event was allowed in the state at
that point.

## 7. Keep a trace database to catch regressions in the spec itself

When a spec change turns tests red, either the system broke or the spec
did. Record traces from passing runs (start a trace in `BeforeEach`, append
in `OnStepExecuted`, keep it in `AfterEach` when `info.Success`), and replay
them through rule 3 in CI after every spec change. A trace that used to
pass and now fails is a spec regression until proven otherwise.

Never commit the traces: they grow with every run, and git keeps every
version forever. Store them outside the repo — attached to the release with
the rest of the contract (ship skill, COMPAT.md rule 4), or in an artifact
store keyed by release — and commit only a manifest: one line per trace
with its location, checksum, header (rule 3), and coverage tags. CI fetches
what the manifest names, checks every checksum, and replays; a trace that's
missing or doesn't match its checksum fails the build instead of being
skipped. Keep the set small rather than the storage cheap: a prefix of an
accepted trace is still accepted, so cut each trace after the last step
that adds coverage, and drop a trace whose tags another one already covers.

A non-deterministic system doesn't make the database flaky: replay never
calls the system, so the same trace always gets the same verdict. It does
make every trace a sample — a run that saw `Completed` says nothing about
the spec's `Failed` branch. So:

- **Keep by coverage, not volume.** Keep at least one trace per operation
  and outcome, including passing runs from the scheduled fault and
  concurrent suites (COMPAT.md rule 6). `Allows` doesn't report which
  outcome matched, so tag each trace with the generated case it came from
  (`info.TestCase` in `BeforeEach`; each case is a path through the spec's
  graph) or, for a trace from another language, with each step's operation
  and kind of response (status, error type). Report coverage that drops
  after a change.
- **Never overwrite a rare branch.** When the behavior changed on purpose,
  re-record only the traces the spec now rejects, move the old ones to a
  rejected set the spec must keep rejecting, and say so in the commit.
  Re-recording everything trades the lost response you saw once for a run
  that didn't hit it.
- **Bound the ambiguity.** Record in the manifest how many candidate
  states the trace ended with — `info.FinalState.StatesAndStepFunctions.Count`
  in `AfterEach` when you record it, or the replayed profile's count on its
  first replay. Fail a later replay
  that ends with more: a read that stopped narrowing (ASYNC.md rule 3) is a
  regression too.

Checking the system, not the spec, against the last release is COMPAT.md.

## 8. Mutate traces to prove the spec rejects wrong answers

The trace database only catches a spec that got stricter; a spec that
accepts everything passes it too. Take recorded traces, change one response
field per copy — a status code, an amount, an ID, a `Pending` that should
be `Completed` — and assert the spec rejects every copy. Mutate into a
wrong answer, not into another explanation the spec declares: a success
turned into a timeout is rightly accepted while failure outcomes are on
(FAULTS.md rule 2), and a change to a field the contract never promised is
rightly ignored (SPEC.md rule 9). A mutant that passes otherwise is a
predicate that doesn't check what it should (SPEC.md rule 7); strengthen
it, or note why that field is not part of the contract.

---

Two corpora, two jobs. Traces (rules 3, 7, 8) hold what the system did and
are judged by the spec alone; they catch a spec that changed. Test plans
(rule 5) hold only what to call and run again against the system; they
catch a system that changed. A failing generated sequence belongs with the
test plans, not in the trace database.

Concurrent groups are the subject of CONCURRENCY.md; traces whose responses
are ambiguous (timeouts, 500s) need the outcomes in FAULTS.md.
