# Timeouts, 500s, and indefinite failures

A call timed out. Maybe the request never arrived, maybe the server did the
work and the response got lost — from the client both look the same, and
the system is in a different state in each. The spec lists every
explanation and lets later responses decide. Apply the rules in order.

## 1. Sort every response into one of three kinds

- **Success** — the server did the work and you saw the result.
- **Definite failure** — the server refused (400, 404, 409, a domain
  exception) and did nothing. One outcome, `.SameState()`.
- **Indefinite failure** — timeout, connection reset, 500, 503: you can't
  tell whether the effect happened. Two outcomes.

Make the response type able to say "indefinite" (an `IsTimeout` or
`IsIndefiniteFailure` flag set by the client wrapper), or declare the
exception your client throws with `Expect.Throws<TException>`.

## 2. An indefinite failure is two outcomes, not a guess

```csharp
return Expect.OneOf(
    Expect.That<CreateAccountResponse>(r => r.IsSuccess && r.Balance == 0, "Created")
          .ThenState<BankState>(next => next.Accounts[request.AccountId] = 0),
    Expect.That<CreateAccountResponse>(r => r.IsTimeout, "Timeout: request lost")
          .SameState(),
    Expect.That<CreateAccountResponse>(r => r.IsTimeout, "Timeout: response lost")
          .ThenState<BankState>(next => next.Accounts[request.AccountId] = 0));
```

A timeout matches both of the last two outcomes, so the state profile now
holds both worlds. Keep both: "a timeout means it failed" rejects a
correct server the first time the response is lost.

## 3. Later responses resolve the ambiguity — and catch the bug

After the timeout, `GetAccount("alice")` → 404 eliminates the world where
alice exists; → 200 eliminates the other. The bug is a response no
surviving world explains: a 404, then a deposit to alice that succeeds.
Write reads that depend on state (ASYNC.md rule 3) so they can do the
eliminating.

## 4. Add failure outcomes in one place, not in every operation

Most operations need the same two extra outcomes. Put them in a base class
that wraps happy-path logic, as the `TodoList-FaultInjection` sample does:

```csharp
public abstract class FaultTolerantOperation<TReq, TResp, TState> : Operation<TReq, TResp, TState>
    where TState : class, IState
{
    protected FaultTolerantOperation(string name) : base(name) { }

    protected abstract ExpectedOutcomes ApplyInternal(TReq request, TState state);

    public sealed override ExpectedOutcomes Apply(TReq request, TState state)
    {
        var definite = ApplyInternal(request, state);
        if (!IndefiniteFailureSemantics.Enabled) return definite;   // rule 6

        var outcomes = definite.PossibleOutcomes.ToList();
        // + "indefinite failure, state unchanged"
        // + for each state-changing outcome: "indefinite failure, same next state"
        return new ExpectedOutcomes(outcomes.ToArray());
    }
}
```

Operations then declare only their definite behavior, and the failure model
can't drift between them.

Inline operations have no base class; two helpers do the same job. A read
or a refusal gets "timeout, nothing changed"; a write gets the three
outcomes of rule 2. Every return in the spec goes through one of them,
including the refusals, since a lost 404 is still a timeout:

```csharp
static ExpectedOutcomes Settled<T>(ExpectedOutcomeBuilder<T> definite) where T : ITimeout =>
    Faults.On
        ? Expect.OneOf(definite.SameState(), Timeout<T>("nothing changed").SameState())
        : definite.SameState();

static ExpectedOutcomes Writes<T>(ExpectedOutcomeBuilder<T> ok, Action<AppState> effect)
    where T : ITimeout =>
    Faults.On
        ? Expect.OneOf(ok.ThenState<AppState>(effect),
                       Timeout<T>("request lost").SameState(),
                       Timeout<T>("response lost").ThenState<AppState>(effect))
        : ok.ThenState<AppState>(effect);
```

## 5. When the effect may have happened but you never saw its ID

A create that timed out might have made a server-generated ID you'll never
learn. Model the uncertainty explicitly — a `MaybeExists` list or a
`HasUnknownJob` flag — and let later listings accept one unrecognized item
while that flag is set, then capture it and clear the flag. Leave the ID
unnamed; a placeholder never matches a real response. When the ID is a
function of state (the next number of a counter), the spec predicts it and
needs no flag: the lost create is just the two outcomes of rule 2.

## 6. Keep exploration deterministic; let execution see the faults

Every indefinite outcome doubles the branches, so generating with failure
outcomes enabled explodes the graph with worlds no fault-free path needs.
Generate with them off and run with them on, using a flag you own (the
sample's `IndefiniteFailureSemantics`, an `AsyncLocal<bool?>` that reads as
on unless set, read by the
base class):

```csharp
var tests = IndefiniteFailureSemantics.Suppress(() =>
    spec.GenerateTests(initial, inputs, new TestGenerationOptions { MaxDepth = 4 }));

IndefiniteFailureSemantics.Enabled = true;
var results = await spec.RunTests(context, initial, tests, options);
```

## 7. Inject faults where the system meets the outside world

Ambiguity needs a cause. Wrap the client to fail before sending (request
lost) or after receiving (response lost), put a proxy in the path that drops
or delays, or make the data layer fail before or after the save. Inject on
both sides, or one of the two worlds in rule 2 is never exercised.

## 8. Retry what's safe to repeat, after the spec accepts it

A response that is safe to repeat (429, a 503 the server promises did
nothing) can be retried by the runner instead of carried through the rest
of the test. The runner asks `TestExecutionOptions.ShouldRetry` only after
the spec has accepted the response, so declare it first — a definite
failure, `.SameState()` — then retry it with a cap:

```csharp
// Match your concrete response type; a generic ApiResult<T> needs its T.
ShouldRetry = (op, request, response, executions) => response is ApiResult<Account> { StatusCode: 429 }
    ? new RetryBehavior
      {
          ShouldRetry = executions < 5,
          WaitTimeInMilliseconds = 200,     // default 1000
          ShouldFailTest = executions >= 5, // without it, the 5th 429 passes the step
      }
    : new RetryBehavior(),                  // no retry
```

A response the spec rejects fails the test before `ShouldRetry` runs.
Poll calls never consult `ShouldRetry`: a 429 on the poll spends one of
the `PollingSetup.MaxRetryCount` attempts (ASYNC.md rule 5).

## 9. Make restart an operation

A system that loses acknowledged work on restart answers every call
correctly until it reboots. Add `Restart` to the spec. Its `Apply` keeps
what the system promises is durable and drops what it doesn't — sessions,
caches, unflushed or in-flight work — so the explorer puts a restart
between every pair of calls:

```csharp
spec.Operation<Unit, Unit>("Restart", (_, state) =>
    Expect.Unit("Restart keeps every acknowledged write, drops sessions")
          .ThenState<AppState>(next => next.Sessions.Clear()));

spec.ExecuteWith<AppHost>()
    .BindAsync<Unit, Unit>("Restart", async (host, _) =>
    {
        await host.RestartAsync(); // dispose and rebuild over the same storage
        return Unit.Value;
    });
```

Kill the process rather than shutting it down gracefully when the promise
is crash safety, and rebuild the clients the other bindings use. Combined
with rule 2, a restart while a call is in flight is an indefinite failure.
Background jobs (ASYNC.md) that must survive a restart keep their step
functions across it.

State recomputed on boot (a counter rebuilt from the surviving rows)
breaks only in an exact order: create, archive, restart, create reuses the
archived number. Plain walks can miss it, so give `Restart` its own
input and pin a sequence like that as a manual case once found.

## Done when

- Every timeout, reset, and 5xx maps to an indefinite failure the response
  type can express (rule 1).
- Every write has three outcomes, success, request lost, and response lost
  (rule 2), added in one base class or helper that every return goes
  through, refusals included (rule 4).
- Tests generate with failure outcomes off and run with them on (rule 6).
- Faults are injected both before sending and after receiving (rule 7).
- When the system promises durability: `Restart` is an operation with its
  own input (rule 9).

---

The same profile mechanics drive ASYNC.md: a pending job is uncertainty
that resolves over time. CONCURRENCY.md combines with this branch when a
failed call might still have taken effect.
