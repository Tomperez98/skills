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
in `OnStepExecuted`, keep it in `AfterEach` when `info.Success`), commit them
while they're small (past that, store them with the release and commit a
manifest of their checksums), and replay them through rule 3 in CI after
every spec change. A trace that
used to pass and now fails is a spec regression until proven otherwise;
when the behavior changed on purpose, re-record and say so in the commit.
Checking the system, not the spec, against the last release is COMPAT.md.

---

Concurrent groups are the subject of CONCURRENCY.md; traces whose responses
are ambiguous (timeouts, 500s) need the outcomes in FAULTS.md.
