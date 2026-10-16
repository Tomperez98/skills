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
ones that explain the response, and returns them as the next profile. Carry
`next` into the following call; a fresh state judges the step against the
wrong world. `message` is the spec's explanation when nothing matches.
`Allows` is the API (some docs show a `spec.Validate`, which doesn't
exist).

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

The scenario now says only _what to run_. When a rule changes, the spec
changes and every scenario follows.

## 3. Validate traces from any language

The system can be Go, Python, Rust — the spec only needs to see what
happened. Have the system emit one entry per call (operation name, request
JSON, response JSON), then walk it:

```csharp
// Default options match names case-sensitively and skip unknown fields, so
// a camelCase trace would deserialize into nulls and the spec would judge
// garbage. Match the system's casing and fail on anything unmapped.
var json = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow,
};
var profile = new StateProfile(new BankState());
foreach (var (entry, i) in trace.Select((e, i) => (e, i)))
{
    var op = spec.GetOperation(entry.Operation);
    var req = JsonSerializer.Deserialize(entry.Request.GetRawText(), op.RequestType, json);
    var resp = JsonSerializer.Deserialize(entry.Response.GetRawText(), op.ResponseType, json);

    var (ok, msg, next) = spec.Allows(op, req, resp, profile);
    if (!ok) throw new Exception($"Violation at step {i} ({entry.Operation}): {msg}");
    profile = next;
}
```

The trace's operation names must match the spec's exactly, its JSON must
deserialize into the spec's request and response types, and the system must
really be in the initial state when the trace starts — reset it in tests,
or start a production trace from a snapshot.

The system can record the wire format and leave the spec's vocabulary to
the reader: log `createIssue` with `{"id": "ENG-1"}` and let the replay
map it to `CreateIssue` and unwrap a request the spec models as a plain
`string`. Log lifecycle events too (`reset`, `boot`): a boot after calls is
a `Restart` the replay feeds through `Allows` with `Unit.Value` for
request and response, so durability is judged from traffic as well.

The oracle is only as thorough as the traffic, so aim the workload: reuse
IDs the server returned, race a call against copies of itself, and cover
each boundary. Then corrupt single responses in a recorded trace and
require each corrupted trace to be rejected (TRACES.md rule 7), or a green
replay proves nothing.

Record the raw request and response, IDs and timestamps included. A value
that differs on every run is evidence: either the spec captures it and
holds later steps to it (SPEC.md rule 9), or the spec leaves it out
(SPEC.md rule 10) and it costs nothing; a placeholder can break the
capture. Credentials are the exception. Drop auth headers, cookies, and
tokens before a trace is written, because traces get stored and shared and
the spec never judges a credential.
Personal data from a production trace may be replaced only in fields the
spec leaves out. Give each trace a header naming where
it started (a reset or a snapshot), the spec version that accepted it, and
whether failure outcomes were enabled (FAULTS.md rule 6) — replay with the
same setting, or every timeout in a fault run reads as a violation. A trace
that no longer deserializes into the spec's types is a shape break, not a
rejection — report it apart from the spec's verdicts.

## 4. Group concurrent calls only when they truly overlapped

Calls that ran at the same time go to `AllowsConcurrent`, which accepts the
results if _some_ sequential order explains them:

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
builds segments from them. Sweep calls by start time and join a call to
the group while it started before the group's latest end. Clocks like
`performance.now()` restart with the process, so close the group at every
boot. A window measured inside the server is narrower than the client's, so
it can only under-group, which keeps the check strict.

```json
[
  [{ "operation": "CreateAccount", "request": {}, "response": {} }],
  [
    { "operation": "Withdraw", "request": {}, "response": {} },
    { "operation": "Withdraw", "request": {}, "response": {} }
  ]
]
```

## 5. Export test plans for a runner in another language

The spec can still choose the sequences even when .NET doesn't run them:

```csharp
var context = spec.CreateTestingContext();
var tests = spec.GenerateTests(new BankState(), inputs, gen);
TestCaseGenerator.SaveSequentialTestCases(context, header, "test-cases.json", tests);
```

`header` is any class implementing the empty `ITestingMetadata` interface;
it's written as the file's `Metadata` object, next to `TestCases`, so the
plan carries the same header as a trace (rule 3). The overload without it
writes just the cases.

Each case lists `OperationCalls` with `Input.OperationName` and
`Input.SerializedRequest` (PascalCase, default `System.Text.Json` options);
concurrent cases use `Segments`. Your runner resets
the system, executes each call, records the trace, and feeds it back through
rule 3. When `DerivedFromOperationCalls` names an earlier call,
`SerializedRequest` is what the derivation produced from the spec's _mock_
response at generation time — a placeholder ID like `"mock-1"` for a
server-generated value. Rebuild the request from that call's real response
(`DerivationVariant` says which variant). Polling isn't fully in the file:
`Polling` holds only a per-input override (`WithPolling`), not the setup
configured on the operation, and the built-in runner polls only when a call
leaves unfinished background work. Unless `SkipPolling` is set, poll after every
call that starts background work, using the input's `Polling` or, when it's
`null`, the operation's own setup. Need the raw graph instead?
`TestCaseGenerator.ExploreStateSpace(…)` returns the root `StateGraphNode` to
walk however you like.

## 6. Events are requests with an empty response

A system that emits events (webhooks, messages) fits the same shape: model
each event as an operation whose request is the event and whose response is
`Unit`. The spec then checks that each event was allowed in the state at
that point.

## Done when

- Every `Allows` call takes the profile the previous call returned (rule 1).
- Hand-written tests assert only through the spec and reset the profile
  together with the system (rule 2).
- Trace replay matches the system's casing and fails on unmapped fields;
  each trace starts from a reset or snapshot its header names, and holds no
  credentials (rule 3).
- Copies of a recorded trace with one response corrupted are each rejected
  (rule 3, TRACES.md rule 7).
- With concurrent calls: only calls whose time windows overlapped share an
  `AllowsConcurrent` group (rule 4).

---

Traces judged this way are also the evidence for testing the spec itself:
recording them, replaying them on every spec change, and mutating them is
TRACES.md. Concurrent groups are the subject of CONCURRENCY.md; traces
whose responses are ambiguous (timeouts, 500s) need the outcomes in
FAULTS.md.
